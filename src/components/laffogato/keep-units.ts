/**
 * "Sirena Espresso Blend 250 g" keeps "250 g" on one line: a no-break space
 * between a quantity and its unit, so a narrow card never leaves the "G"
 * alone on the next line.
 */
export function keepUnits(name: string): string {
  return name.replace(/(\d)\s+(g|gr|kg|ml|cl|lt|l|adet)\b/gi, "$1 $2");
}
