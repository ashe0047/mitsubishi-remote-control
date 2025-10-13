/**
 * Convert Celsius to Fahrenheit
 * @param celsius - Temperature in Celsius
 * @returns Temperature in Fahrenheit (rounded)
 */
export const celsiusToFahrenheit = (celsius: number): number => {
  return Math.round(celsius * 1.8 + 32);
};

/**
 * Convert Fahrenheit to Celsius
 * @param fahrenheit - Temperature in Fahrenheit
 * @returns Temperature in Celsius (rounded)
 */
export const fahrenheitToCelsius = (fahrenheit: number): number => {
  return Math.round((fahrenheit - 32) / 1.8);
};

/**
 * Display temperature in the specified unit
 * @param temp - Temperature value in Celsius
 * @param useFahrenheit - Whether to display in Fahrenheit
 * @returns Formatted temperature string with unit
 */
export const displayTemperature = (
  temp: number,
  useFahrenheit: boolean = false
): string => {
  const displayTemp = useFahrenheit ? celsiusToFahrenheit(temp) : temp;
  const unit = useFahrenheit ? '°F' : '°C';
  return `${displayTemp}${unit}`;
};

/**
 * Get the color class for a temperature value
 * @param temp - Temperature in Celsius
 * @returns Tailwind CSS color classes
 */
export const getTemperatureColor = (temp: number): string => {
  if (temp <= 18) return 'text-blue-600 dark:text-blue-400';
  if (temp <= 22) return 'text-green-600 dark:text-green-400';
  if (temp <= 26) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};
