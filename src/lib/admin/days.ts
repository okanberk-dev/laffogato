// Plain TS module (no "server-only") so client components can import the
// day-of-week vocabulary used by settings, hours displays, etc.

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "Pazartesi",
  tue: "Salı",
  wed: "Çarşamba",
  thu: "Perşembe",
  fri: "Cuma",
  sat: "Cumartesi",
  sun: "Pazar",
};

export interface OpeningHour {
  /** HH:MM 24-hour. */
  open: string;
  close: string;
  closed: boolean;
}

export type WeeklyHours = Record<DayOfWeek, OpeningHour>;

/** schema.org `DayOfWeek` names, for `openingHoursSpecification`. */
export const DAY_SCHEMA_ORG: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
