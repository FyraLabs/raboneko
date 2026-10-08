const northAmericanTimeZoneAbbreviations = new Set([
  "AKDT",
  "AKST",
  "ADT",
  "AST",
  "CDT",
  "CST",
  "EDT",
  "EST",
  "HDT",
  "HST",
  "MDT",
  "MST",
  "NDT",
  "NST",
  "PDT",
  "PST",
]);

const getTimeZonePart = (
  timeZone: string,
  date: Date,
  timeZoneName: "longOffset" | "short",
): string => {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName,
  })
    .formatToParts(date)
    .find(({ type }) => type === "timeZoneName");
  if (!part) throw new Error(`Unable to format timezone ${timeZone}`);
  return part.value;
};

export const formatTimeZone = (timeZone: string, date = new Date()): string => {
  const rawOffset = getTimeZonePart(timeZone, date, "longOffset");
  const offset = rawOffset === "GMT"
    ? "UTC+00:00"
    : rawOffset.replace(/^GMT/, "UTC");

  const abbreviation = getTimeZonePart(timeZone, date, "short");
  if (
    timeZone.startsWith("America/") &&
    northAmericanTimeZoneAbbreviations.has(abbreviation)
  ) {
    return `${abbreviation} (${offset}; ${timeZone})`;
  }
  return `${offset} (${timeZone})`;
};
