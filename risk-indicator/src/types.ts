export type AnnualReturnItem = {
  year: number;
  returnPct: number;
  annualized?: boolean;
  monthsElapsed?: number | null;
};

export type AnnualReturnColumn = {
  bucket: number;
  items: AnnualReturnItem[];
};

export type RiskScatterPoint = {
  year: number;
  month?: number;
  key?: string;
  label?: string;
  returnPct: number;
  vixAvg: number;
  annualized?: boolean;
};

export type AnnualReturnsPayload = {
  generatedAt: string;
  sourceName: string;
  sourceUrl: string;
  methodology: string;
  startYear: number;
  endYear: number;
  yearCount: number;
  latestYear: number;
  latestReturnPct: number | null;
  latestAnnualized?: boolean;
  latestMonthsElapsed?: number | null;
  previousYear: number;
  previousReturnPct: number | null;
  latestVolatilityPct?: number | null;
  previousVolatilityPct?: number | null;
  latestVixAvg?: number | null;
  previousVixAvg?: number | null;
  latestScatterKey?: string | null;
  riskIndicator?: {
    startDate: string;
    endDate: string;
    fearThreshold: number;
    complacencyThreshold: number;
    latest: {
      date: string;
      year: number;
      month: number;
      vixClose: number;
      ma50: number;
      std50: number;
      score: number;
      deviationPct: number;
    } | null;
    series: Array<{
      date: string;
      year: number;
      month: number;
      vixClose: number;
      ma50: number;
      std50: number;
      score: number;
      deviationPct: number;
    }>;
    markers: Array<{
      date: string;
      year: number;
      month: number;
      vixClose: number;
      ma50: number;
      std50: number;
      score: number;
      deviationPct: number;
    }>;
  };
  forecastChart?: {
    actualSeries: Array<{
      year: number;
      returnPct: number;
    }>;
    forecasts: Array<{
      issueYear: number;
      targetYear: number;
      issueDate: string;
      issueScore: number;
      issueVixClose: number;
      forecastReturnPct: number;
      actualReturnPct: number | null;
      trainingCount: number;
    }>;
    averageAbsError: number | null;
    latestForecast: {
      issueYear: number;
      targetYear: number;
      issueDate: string;
      issueScore: number;
      issueVixClose: number;
      forecastReturnPct: number;
      actualReturnPct: number | null;
      trainingCount: number;
    } | null;
  };
  indexForecastChart?: {
    horizonTradingDays: number;
    actualSeries: Array<{
      date: string;
      level: number;
    }>;
    backtestSeries: Array<{
      issueDate: string;
      targetDate: string;
      issueLevel: number;
      targetLevel: number;
      forecastLevel: number;
      issueScore: number;
      issueVixClose: number;
      forecastReturnPct: number;
      actualReturnPct: number;
      trainingCount: number;
    }>;
    averageAbsError: number | null;
    latestForecast: {
      issueDate: string;
      targetDate: string;
      issueLevel: number;
      forecastLevel: number;
      issueScore: number;
      issueVixClose: number;
      forecastReturnPct: number;
      trainingCount: number;
    } | null;
  };
  columns: AnnualReturnColumn[];
  riskScatter: RiskScatterPoint[];
  returns: Array<{
    year: number;
    returnPct: number;
    bucket: number;
    annualized?: boolean;
  }>;
};
