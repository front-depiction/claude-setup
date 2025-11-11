/**
 * Concurrent Edit Test File
 * This file is designed to be edited by multiple agents simultaneously
 * to test file locking mechanisms.
 */

// Section 1: Basic Functions
export function addNumbers(a: number, b: number): number {
  return a + b;
}

export function subtractNumbers(a: number, b: number): number {
  return a - b;
}

export function multiplyNumbers(a: number, b: number): number {
  return a * b;
}

// Section 2: String Utilities
export function reverseString(str: string): string {
  return str.split('').reverse().join('');
}

export function capitalizeString(str: string): string {
  return str.toUpperCase();
}

// Section 3: Array Operations
export function filterEvenNumbers(numbers: number[]): number[] {
  return numbers.filter(n => n % 2 === 0);
}

export function sumArray(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}

export function findMaxNumber(numbers: number[]): number {
  return Math.max(...numbers);
}

// Section 4: Object Utilities
export interface User {
  id: number;
  name: string;
  email: string;
}

export function createUser(id: number, name: string, email: string): User {
  return { id, name, email };
}

// Section 5: Async Operations
export async function fetchData(url: string): Promise<string> {
  // Placeholder implementation
  return `Data from ${url}`;
}

export async function processData(data: string): Promise<string> {
  // Placeholder implementation
  return data.toUpperCase();
}
