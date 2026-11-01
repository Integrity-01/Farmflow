type Dimension = 'volume' | 'mass' | 'count';

interface UnitDefinition {
  dimension: Dimension;
  /** Multiplier to the dimension base unit (litre, kilogram, item). */
  toBase: number;
}

const UNITS: Record<string, UnitDefinition> = {
  ml: { dimension: 'volume', toBase: 0.001 },
  millilitre: { dimension: 'volume', toBase: 0.001 },
  millilitres: { dimension: 'volume', toBase: 0.001 },
  milliliter: { dimension: 'volume', toBase: 0.001 },
  liters: { dimension: 'volume', toBase: 1 },
  liter: { dimension: 'volume', toBase: 1 },
  litre: { dimension: 'volume', toBase: 1 },
  litres: { dimension: 'volume', toBase: 1 },
  l: { dimension: 'volume', toBase: 1 },
  gallon: { dimension: 'volume', toBase: 3.785411784 },
  gallons: { dimension: 'volume', toBase: 3.785411784 },
  g: { dimension: 'mass', toBase: 0.001 },
  gram: { dimension: 'mass', toBase: 0.001 },
  grams: { dimension: 'mass', toBase: 0.001 },
  kg: { dimension: 'mass', toBase: 1 },
  kilogram: { dimension: 'mass', toBase: 1 },
  kilograms: { dimension: 'mass', toBase: 1 },
  tonne: { dimension: 'mass', toBase: 1000 },
  tonnes: { dimension: 'mass', toBase: 1000 },
  ton: { dimension: 'mass', toBase: 1000 },
  tons: { dimension: 'mass', toBase: 1000 },
  lb: { dimension: 'mass', toBase: 0.45359237 },
  lbs: { dimension: 'mass', toBase: 0.45359237 },
  pound: { dimension: 'mass', toBase: 0.45359237 },
  pounds: { dimension: 'mass', toBase: 0.45359237 },
};

function normalize(unit: string): string {
  return unit.trim().toLowerCase();
}

/**
 * Converts a quantity between compatible units. Returns null when the units are
 * unknown or belong to different dimensions; callers must reject those instead
 * of silently assuming a 1:1 conversion.
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = normalize(fromUnit);
  const to = normalize(toUnit);
  if (from === to) return quantity;

  const fromDef = UNITS[from];
  const toDef = UNITS[to];
  if (!fromDef || !toDef || fromDef.dimension !== toDef.dimension) return null;

  return (quantity * fromDef.toBase) / toDef.toBase;
}

export function unitsAreCompatible(fromUnit: string, toUnit: string): boolean {
  return convertQuantity(1, fromUnit, toUnit) !== null;
}
