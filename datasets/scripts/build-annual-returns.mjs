import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetsDir = path.resolve(__dirname, "..");
const outputDir = path.join(datasetsDir, "exports");
const outputFile = path.join(outputDir, "annual-returns.json");

const SOURCE_URL = "https://www.officialdata.org/us/stocks/s-p-500/1871";
const SOURCE_NAME = "Official Data";
const SP500_DAILY_SOURCE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500";
const SP500_DAILY_SOURCE_NAME = "FRED SP500";
const VIX_SOURCE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS";
const VIX_SOURCE_NAME = "FRED VIXCLS";
const BUCKETS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function bucketFor(returnPct) {
  if (returnPct >= 50) return 50;
  return clamp(Math.floor(returnPct / 10) * 10, -50, 50);
}

function parseDataset(html) {
  const entries = [];
  const seen = new Set();
  const re = /\["(\d{4})-(\d{2})",([0-9.]+),(-?[0-9.eE]+)(?:,([0-9.]+))?\]/g;

  for (const match of html.matchAll(re)) {
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const amount = Number.parseFloat(match[3]);
    const monthReturnPct = Number.parseFloat(match[4]) * 100;
    const priceLevel = match[5] ? Number.parseFloat(match[5]) : null;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      year,
      month,
      key,
      amount,
      monthReturnPct,
      priceLevel,
    });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

function parseFredLevelCsv(csvText) {
  return csvText
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(",");
      const year = Number.parseInt(date.slice(0, 4), 10);
      const month = Number.parseInt(date.slice(5, 7), 10);
      const level = value === "." ? null : Number.parseFloat(value);
      const key = `${year}-${String(month).padStart(2, "0")}`;
      return { date, year, month, key, level };
    })
    .filter((entry) => Number.isFinite(entry.level));
}

function parseVixCsv(csvText) {
  return csvText
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(",");
      const year = Number.parseInt(date.slice(0, 4), 10);
      const month = Number.parseInt(date.slice(5, 7), 10);
      const vixClose = value === "." ? null : Number.parseFloat(value);
      const key = `${year}-${String(month).padStart(2, "0")}`;
      return { date, year, month, key, vixClose };
    })
    .filter((entry) => Number.isFinite(entry.vixClose));
}

function quantile(sortedValues, q) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function fitSimpleRegression(samples) {
  if (samples.length < 2) return null;
  const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
  const meanY = samples.reduce((sum, sample) => sum + sample.y, 0) / samples.length;
  let num = 0;
  let den = 0;

  for (const sample of samples) {
    num += (sample.x - meanX) * (sample.y - meanY);
    den += (sample.x - meanX) ** 2;
  }

  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];

    const div = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= div;

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }

  return a.map((row) => row[n]);
}

function fitRidgeRegression(samples, lambda = 1) {
  if (samples.length < 10) return null;
  const featureCount = samples[0].x.length;
  const means = Array(featureCount).fill(0);
  const stds = Array(featureCount).fill(0);

  for (const sample of samples) {
    for (let i = 0; i < featureCount; i += 1) means[i] += sample.x[i];
  }
  for (let i = 0; i < featureCount; i += 1) means[i] /= samples.length;

  for (const sample of samples) {
    for (let i = 0; i < featureCount; i += 1) stds[i] += (sample.x[i] - means[i]) ** 2;
  }
  for (let i = 0; i < featureCount; i += 1) {
    stds[i] = Math.sqrt(stds[i] / Math.max(samples.length - 1, 1));
    if (!Number.isFinite(stds[i]) || stds[i] === 0) stds[i] = 1;
  }

  const zSamples = samples.map((sample) => ({
    x: sample.x.map((value, i) => (value - means[i]) / stds[i]),
    y: sample.y,
  }));
  const yMean = zSamples.reduce((sum, sample) => sum + sample.y, 0) / zSamples.length;

  const xtx = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const xty = Array(featureCount).fill(0);
  for (const sample of zSamples) {
    for (let i = 0; i < featureCount; i += 1) {
      xty[i] += sample.x[i] * (sample.y - yMean);
      for (let j = 0; j < featureCount; j += 1) {
        xtx[i][j] += sample.x[i] * sample.x[j];
      }
    }
  }
  for (let i = 0; i < featureCount; i += 1) xtx[i][i] += lambda;

  const betas = solveLinearSystem(xtx, xty);
  if (!betas) return null;

  return {
    means,
    stds,
    betas,
    yMean,
  };
}

function predictRidge(model, x) {
  const z = x.map((value, i) => (value - model.means[i]) / model.stds[i]);
  let prediction = model.yMean;
  for (let i = 0; i < z.length; i += 1) prediction += model.betas[i] * z[i];
  return prediction;
}

function buildAnnualReturns(monthly) {
  const december = monthly.filter((entry) => entry.month === 12);
  const annual = [];

  for (let i = 1; i < december.length; i += 1) {
    const prev = december[i - 1];
    const current = december[i];
    const returnPct = ((current.amount / prev.amount) - 1) * 100;

    annual.push({
      year: current.year,
      returnPct,
      bucket: bucketFor(returnPct),
    });
  }

  return annual;
}

function sampleStdDev(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function buildAnnualVolatility(monthly) {
  const years = [...new Set(monthly.map((entry) => entry.year))].sort((a, b) => a - b);
  const annualRisk = [];

  for (const year of years) {
    const entries = monthly
      .filter((entry) => entry.year === year)
      .sort((a, b) => a.month - b.month);

    const monthlyReturns = entries
      .map((entry) => entry.monthReturnPct / 100)
      .filter((value) => Number.isFinite(value));

    const stdDev = sampleStdDev(monthlyReturns);
    if (stdDev == null) continue;

    annualRisk.push({
      year,
      volatilityPct: stdDev * Math.sqrt(12) * 100,
      annualized: year === Math.max(...years) && entries.length < 12,
      monthsElapsed: entries.length,
    });
  }

  return annualRisk;
}

function buildAnnualVix(vixDaily) {
  const sums = new Map();

  for (const entry of vixDaily) {
    const current = sums.get(entry.year) ?? { sum: 0, count: 0 };
    current.sum += entry.vixClose;
    current.count += 1;
    sums.set(entry.year, current);
  }

  return [...sums.entries()]
    .map(([year, stats]) => ({
      year,
      vixAvg: stats.sum / stats.count,
    }))
    .sort((a, b) => a.year - b.year);
}

function buildMonthlyVix(vixDaily) {
  const sums = new Map();

  for (const entry of vixDaily) {
    const current = sums.get(entry.key) ?? {
      year: entry.year,
      month: entry.month,
      key: entry.key,
      sum: 0,
      count: 0,
    };
    current.sum += entry.vixClose;
    current.count += 1;
    sums.set(entry.key, current);
  }

  return [...sums.values()]
    .map((entry) => ({
      year: entry.year,
      month: entry.month,
      key: entry.key,
      vixAvg: entry.sum / entry.count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function buildDailyVixStats(vixDaily, windowSize = 50) {
  const series = [];

  for (let i = windowSize - 1; i < vixDaily.length; i += 1) {
    const window = vixDaily.slice(i - windowSize + 1, i + 1);
    const values = window.map((entry) => entry.vixClose);
    const ma = values.reduce((sum, value) => sum + value, 0) / values.length;
    const std = sampleStdDev(values);
    if (!std || !Number.isFinite(std)) continue;

    const current = vixDaily[i];
    const score = (current.vixClose - ma) / std;
    const deviationPct = ((current.vixClose / ma) - 1) * 100;

    series.push({
      date: current.date,
      year: current.year,
      month: current.month,
      key: current.key,
      vixClose: Number(current.vixClose.toFixed(2)),
      ma50: Number(ma.toFixed(2)),
      std50: Number(std.toFixed(2)),
      score: Number(score.toFixed(2)),
      deviationPct: Number(deviationPct.toFixed(2)),
    });
  }

  return series;
}

function buildRiskIndicator(vixDaily, startDate, endDate) {
  const series = buildDailyVixStats(vixDaily).filter((entry) => entry.date >= startDate && entry.date <= endDate);

  const scores = series.map((entry) => entry.score).slice().sort((a, b) => a - b);
  const fearThreshold = Number(quantile(scores, 0.9).toFixed(2));
  const complacencyThreshold = Number(quantile(scores, 0.1).toFixed(2));

  const markers = series.filter((entry, index) => {
    if (index === 0 || index === series.length - 1) return false;
    const prev = series[index - 1];
    const next = series[index + 1];
    const isPeak = entry.score >= fearThreshold && entry.score >= prev.score && entry.score >= next.score;
    const isTrough =
      entry.score <= complacencyThreshold && entry.score <= prev.score && entry.score <= next.score;
    return isPeak || isTrough;
  });

  return {
    startDate,
    endDate,
    fearThreshold,
    complacencyThreshold,
    series,
    markers,
    latest: series.at(-1) ?? null,
  };
}

function buildAnnualForecastChart(vixDaily, annualReturnEntries) {
  const dailyStats = buildDailyVixStats(vixDaily);
  const yearEndStats = Object.fromEntries(
    [...new Set(dailyStats.map((entry) => entry.year))].map((year) => {
      const statsForYear = dailyStats.filter((entry) => entry.year === year);
      return [String(year), statsForYear.at(-1) ?? null];
    }),
  );
  const actualByYear = Object.fromEntries(
    annualReturnEntries.map((entry) => [String(entry.year), Number(entry.returnPct.toFixed(2))]),
  );
  const years = Object.keys(yearEndStats)
    .map((year) => Number.parseInt(year, 10))
    .filter((year) => year >= 1990 && year <= 2025)
    .sort((a, b) => a - b);

  const forecasts = [];
  for (const issueYear of years) {
    const training = years
      .filter((year) => year < issueYear && actualByYear[String(year + 1)] != null && yearEndStats[String(year)])
      .map((year) => ({
        x: yearEndStats[String(year)].score,
        y: actualByYear[String(year + 1)],
      }));

    if (training.length < 8) continue;
    const model = fitSimpleRegression(training);
    const feature = yearEndStats[String(issueYear)];
    if (!model || !feature) continue;

    const targetYear = issueYear + 1;
    const forecastReturnPct = model.intercept + model.slope * feature.score;
    forecasts.push({
      issueYear,
      targetYear,
      issueDate: feature.date,
      issueScore: feature.score,
      issueVixClose: feature.vixClose,
      forecastReturnPct: Number(forecastReturnPct.toFixed(2)),
      actualReturnPct: actualByYear[String(targetYear)] ?? null,
      trainingCount: training.length,
    });
  }

  const actualSeries = annualReturnEntries
    .filter((entry) => entry.year >= 1991 && entry.year <= 2025)
    .map((entry) => ({
      year: entry.year,
      returnPct: Number(entry.returnPct.toFixed(2)),
    }));

  const errors = forecasts
    .filter((entry) => entry.actualReturnPct != null)
    .map((entry) => Math.abs(entry.forecastReturnPct - entry.actualReturnPct));
  const averageAbsError = errors.length > 0
    ? Number((errors.reduce((sum, value) => sum + value, 0) / errors.length).toFixed(2))
    : null;

  const latestForecast = forecasts.at(-1) ?? null;

  return {
    actualSeries,
    forecasts,
    averageAbsError,
    latestForecast,
  };
}

function buildIndexForecastChart(sp500Daily, vixDaily) {
  const horizonTradingDays = 252;
  const dailyStatsByDate = Object.fromEntries(buildDailyVixStats(vixDaily).map((entry) => [entry.date, entry]));
  const aligned = sp500Daily
    .map((entry) => {
      const stat = dailyStatsByDate[entry.date];
      if (!stat) return null;
      return {
        date: entry.date,
        year: entry.year,
        month: entry.month,
        level: entry.level,
        score: stat.score,
        vixClose: stat.vixClose,
      };
    })
    .filter(Boolean);

  const dailyLogReturns = aligned.map((entry, index) => {
    if (index === 0) return 0;
    return Math.log(entry.level / aligned[index - 1].level);
  });

  const rollingMean = (index, window) => {
    const start = index - window + 1;
    if (start < 0) return null;
    let sum = 0;
    for (let i = start; i <= index; i += 1) sum += aligned[i].level;
    return sum / window;
  };

  const rollingVol = (index, window) => {
    const start = index - window + 1;
    if (start < 1) return null;
    const values = dailyLogReturns.slice(start, index + 1);
    const std = sampleStdDev(values);
    return std == null ? null : std * Math.sqrt(252);
  };

  const trailingLogReturn = (index, window) => {
    const start = index - window;
    if (start < 0) return null;
    return Math.log(aligned[index].level / aligned[start].level);
  };

  const maxLag = 252;

  const buildFeatureRow = (index) => {
    if (index < maxLag) return null;
    const ret21 = trailingLogReturn(index, 21);
    const ret63 = trailingLogReturn(index, 63);
    const ret126 = trailingLogReturn(index, 126);
    const ret252 = trailingLogReturn(index, 252);
    const ma50 = rollingMean(index, 50);
    const ma200 = rollingMean(index, 200);
    const rv21 = rollingVol(index, 21);
    const rv63 = rollingVol(index, 63);
    if ([ret21, ret63, ret126, ret252, ma50, ma200, rv21, rv63].some((value) => value == null || !Number.isFinite(value))) {
      return null;
    }
    return [
      aligned[index].score,
      Math.log(aligned[index].vixClose),
      ret21,
      ret63,
      ret126,
      ret252,
      Math.log(aligned[index].level / ma50),
      Math.log(aligned[index].level / ma200),
      rv21,
      rv63,
    ];
  };

  const fitForwardModel = (endIndex, horizon) => {
    const training = [];
    for (let sampleIndex = maxLag; sampleIndex <= endIndex - horizon; sampleIndex += 1) {
      const current = aligned[sampleIndex];
      const future = aligned[sampleIndex + horizon];
      const x = buildFeatureRow(sampleIndex);
      if (!x) continue;
      training.push({
        x,
        y: Math.log(future.level / current.level),
      });
    }
    if (training.length < 252) return null;
    const model = fitRidgeRegression(training, 2);
    if (!model) return null;
    const historicalMean = training.reduce((sum, sample) => sum + sample.y, 0) / training.length;
    return { model, historicalMean, trainingCount: training.length };
  };

  const backtest = [];
  const minLookback = 252;

  for (let issueIndex = maxLag + minLookback; issueIndex < aligned.length - horizonTradingDays; issueIndex += 1) {
    const fit = fitForwardModel(issueIndex, horizonTradingDays);
    if (!fit) continue;

    const issue = aligned[issueIndex];
    const target = aligned[issueIndex + horizonTradingDays];
    const x = buildFeatureRow(issueIndex);
    if (!x) continue;
    const modelReturn = predictRidge(fit.model, x);
    const forecastLogReturn = clamp(0.5 * modelReturn + 0.5 * fit.historicalMean, -0.4, 0.4);
    const forecastLevel = issue.level * Math.exp(forecastLogReturn);
    const forecastReturnPct = ((forecastLevel / issue.level) - 1) * 100;
    const actualReturnPct = ((target.level / issue.level) - 1) * 100;

    backtest.push({
      issueDate: issue.date,
      targetDate: target.date,
      issueLevel: Number(issue.level.toFixed(2)),
      targetLevel: Number(target.level.toFixed(2)),
      forecastLevel: Number(forecastLevel.toFixed(2)),
      issueScore: issue.score,
      issueVixClose: issue.vixClose,
      forecastReturnPct: Number(forecastReturnPct.toFixed(2)),
      actualReturnPct: Number(actualReturnPct.toFixed(2)),
      trainingCount: fit.trainingCount,
    });
  }

  const latestIssueIndex = aligned.length - 1;
  const latestIssue = aligned[latestIssueIndex];
  const latestFit = fitForwardModel(aligned.length - 1, horizonTradingDays);
  let latestForecast = null;
  if (latestFit && latestIssue) {
    const x = buildFeatureRow(latestIssueIndex);
    const modelReturn = x ? predictRidge(latestFit.model, x) : 0;
    const forecastLogReturn = clamp(0.5 * modelReturn + 0.5 * latestFit.historicalMean, -0.4, 0.4);
    const forecastLevel = latestIssue.level * Math.exp(forecastLogReturn);
    const targetDate = new Date(latestIssue.date);
    targetDate.setDate(targetDate.getDate() + 365);
    latestForecast = {
      issueDate: latestIssue.date,
      targetDate: targetDate.toISOString().slice(0, 10),
      issueLevel: Number(latestIssue.level.toFixed(2)),
      forecastLevel: Number(forecastLevel.toFixed(2)),
      issueScore: latestIssue.score,
      issueVixClose: latestIssue.vixClose,
      forecastReturnPct: Number((((forecastLevel / latestIssue.level) - 1) * 100).toFixed(2)),
      trainingCount: latestFit.trainingCount,
    };
  }

  const errors = backtest.map((entry) => Math.abs(((entry.forecastLevel - entry.targetLevel) / entry.targetLevel) * 100));
  const averageAbsError = errors.length > 0
    ? Number((errors.reduce((sum, value) => sum + value, 0) / errors.length).toFixed(2))
    : null;

  return {
    horizonTradingDays,
    actualSeries: aligned
      .filter((entry) => entry.date >= "2017-01-01")
      .map((entry) => ({
        date: entry.date,
        level: Number(entry.level.toFixed(2)),
      })),
    backtestSeries: backtest.filter((entry) => entry.targetDate >= "2017-01-01"),
    averageAbsError,
    latestForecast,
  };
}

function groupColumns(annual) {
  return BUCKETS.map((bucket) => ({
    bucket,
    items: annual
      .filter((entry) => entry.bucket === bucket)
      .sort((a, b) => b.returnPct - a.returnPct)
      .map((entry) => ({
        year: entry.year,
        returnPct: Number(entry.returnPct.toFixed(2)),
        annualized: Boolean(entry.annualized),
        monthsElapsed: entry.monthsElapsed ?? null,
      })),
  }));
}

const html = execFileSync("curl", ["-L", "-s", SOURCE_URL], { encoding: "utf8" });
const sp500DailyCsv = execFileSync("curl", ["-L", "-s", SP500_DAILY_SOURCE_URL], { encoding: "utf8" });
const vixCsv = execFileSync("curl", ["-L", "-s", VIX_SOURCE_URL], { encoding: "utf8" });
const monthly = parseDataset(html);
const sp500Daily = parseFredLevelCsv(sp500DailyCsv);
const vixDaily = parseVixCsv(vixCsv);
const annual = buildAnnualReturns(monthly);
const annualVolatility = buildAnnualVolatility(monthly);
const annualVix = buildAnnualVix(vixDaily);
const monthlyVix = buildMonthlyVix(vixDaily);
const riskIndicator = buildRiskIndicator(vixDaily, "2017-01-01", "2025-12-31");
const forecastChart = buildAnnualForecastChart(vixDaily, annual);
const indexForecastChart = buildIndexForecastChart(sp500Daily, vixDaily);

const fullRange = annual.filter((entry) => entry.year >= 1875 && entry.year <= 2025);
const fullVolatilityRange = annualVolatility.filter((entry) => entry.year >= 1875 && entry.year <= 2025);
const fullVixRange = annualVix.filter((entry) => entry.year >= 1990 && entry.year <= 2025);
const fullMonthlyRange = monthly.filter((entry) => entry.year >= 1990 && entry.year <= 2025);
const columns = groupColumns(fullRange);

const returnByYear = Object.fromEntries(
  fullRange.map((entry) => [
    String(entry.year),
    {
      returnPct: Number(entry.returnPct.toFixed(2)),
      bucket: entry.bucket,
    },
  ]),
);

const volatilityByYear = Object.fromEntries(
  fullVolatilityRange.map((entry) => [
    String(entry.year),
    {
      volatilityPct: Number(entry.volatilityPct.toFixed(2)),
    },
  ]),
);

const vixByYear = Object.fromEntries(
  fullVixRange.map((entry) => [
    String(entry.year),
    {
      vixAvg: Number(entry.vixAvg.toFixed(2)),
    },
  ]),
);

const vixByMonth = Object.fromEntries(
  monthlyVix
    .filter((entry) => entry.year >= 1990 && entry.year <= 2025)
    .map((entry) => [
      entry.key,
      {
        vixAvg: Number(entry.vixAvg.toFixed(2)),
      },
    ]),
);

const monthlyScatter = fullMonthlyRange
  .map((entry) => {
    const risk = vixByMonth[entry.key];
    if (!risk) return null;
    return {
      year: entry.year,
      month: entry.month,
      key: entry.key,
      label: entry.key,
      returnPct: Number(entry.monthReturnPct.toFixed(2)),
      vixAvg: risk.vixAvg,
      annualized: false,
    };
  })
  .filter(Boolean);

const latestMonthlyPoint = monthlyScatter.at(-1) ?? null;

const payload = {
  generatedAt: new Date().toISOString(),
  sourceName: `${SOURCE_NAME} + ${SP500_DAILY_SOURCE_NAME} + ${VIX_SOURCE_NAME}`,
  sourceUrl: `${SOURCE_URL} | ${SP500_DAILY_SOURCE_URL} | ${VIX_SOURCE_URL}`,
  methodology:
    "Annual return is computed from December-to-December changes in the source's cumulative S&P 500 total-return value series. The risk indicator uses daily VIX close from FRED series VIXCLS and calculates a 50-day moving-average deviation score as (VIX - MA50) / rolling 50-day standard deviation. Fear and complacency bands are the 90th and 10th percentiles of the score over the displayed window.",
  startYear: 1875,
  endYear: 2025,
  yearCount: fullRange.length,
  latestYear: 2025,
  latestReturnPct: returnByYear["2025"]?.returnPct ?? null,
  latestAnnualized: false,
  latestMonthsElapsed: null,
  previousYear: 2024,
  previousReturnPct: returnByYear["2024"]?.returnPct ?? null,
  latestVolatilityPct: volatilityByYear["2025"]?.volatilityPct ?? null,
  previousVolatilityPct: volatilityByYear["2024"]?.volatilityPct ?? null,
  latestVixAvg: vixByYear["2025"]?.vixAvg ?? null,
  previousVixAvg: vixByYear["2024"]?.vixAvg ?? null,
  latestScatterKey: latestMonthlyPoint?.key ?? null,
  riskIndicator,
  forecastChart,
  indexForecastChart,
  columns,
  riskScatter: monthlyScatter,
  returns: fullRange.map((entry) => ({
    year: entry.year,
    returnPct: Number(entry.returnPct.toFixed(2)),
    bucket: entry.bucket,
    annualized: Boolean(entry.annualized),
  })),
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Wrote ${payload.yearCount} annual returns to ${outputFile}`);
console.log(`2024: ${payload.previousReturnPct}%`);
console.log(`${payload.latestYear}: ${payload.latestReturnPct}%`);
