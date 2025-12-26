/**
 * Seeded Random Number Generator
 *
 * Uses Mulberry32 algorithm for deterministic, reproducible random generation.
 * Same seed always produces same sequence of numbers.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number between 0 and 1.
   * Mulberry32 algorithm - fast, high-quality 32-bit PRNG.
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer between min (inclusive) and max (inclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean with given probability of true.
   */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick random element from array.
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle array in place (Fisher-Yates).
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick n random elements from array without replacement.
   */
  sample<T>(array: T[], n: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(n, array.length));
  }
}
