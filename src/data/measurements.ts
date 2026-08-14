import type { LengthUnit, WeightUnit } from "./catchLogSettingsContext"

export function centimetersToInches(centimeters: number) {
  return centimeters / 2.54
}

export function inchesToCentimeters(inches: number) {
  return inches * 2.54
}

export function kilogramsToPoundsOunces(kilograms: number) {
  const totalOunces = Math.round((kilograms / 0.45359237) * 16)
  const pounds = Math.floor(totalOunces / 16)
  const ounces = totalOunces % 16

  return { pounds, ounces }
}

export function poundsOuncesToKilograms(pounds: number, ounces: number) {
  return (pounds + ounces / 16) * 0.45359237
}

function cleanNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits)
}

export function formatLength(
  centimeters: number | null,
  lengthUnit: LengthUnit
) {
  if (centimeters === null) {
    return "Not recorded"
  }

  if (lengthUnit === "in") {
    return `${cleanNumber(centimetersToInches(centimeters))} in`
  }

  return `${cleanNumber(centimeters)} cm`
}

export function formatWeight(kilograms: number | null, weightUnit: WeightUnit) {
  if (kilograms === null) {
    return "Not recorded"
  }

  if (weightUnit === "lb-oz") {
    const { pounds, ounces } = kilogramsToPoundsOunces(kilograms)
    return `${pounds} lb ${ounces} oz`
  }

  return `${cleanNumber(kilograms)} kg`
}
