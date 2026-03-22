/**
 * Symbol Search - Find and quick-place symbols
 *
 * Features:
 * - Full-text search
 * - Category filtering
 * - Recent symbols
 * - Favorites
 * - Search history
 */

import { Symbol } from '../DrawingTools/types';

/**
 * Search result with relevance score
 */
export interface SearchResult {
  symbol: Symbol;
  score: number;           // Relevance score 0-1
  matchType: 'name' | 'category' | 'description' | 'partial';
  highlights: string[];    // Matched terms
}

/**
 * Symbol search engine
 */
export class SymbolSearch {
  private symbols: Symbol[] = [];
  private recentSymbols: Symbol[] = [];
  private favoriteSymbols: Set<string> = new Set();
  private searchHistory: string[] = [];
  private maxHistorySize: number = 20;
  private maxRecentSize: number = 10;

  constructor(symbols: Symbol[]) {
    this.symbols = symbols;
  }

  /**
   * Simple search
   */
  search(query: string, limit: number = 10): SearchResult[] {
    if (!query || query.length < 1) {
      return this.getRecent(limit);
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search through symbols
    for (const symbol of this.symbols) {
      const nameMatch = symbol.name.toLowerCase().includes(lowerQuery);
      const categoryMatch = symbol.category?.toLowerCase().includes(lowerQuery);
      const descMatch = symbol.description?.toLowerCase().includes(lowerQuery);

      let score = 0;
      let matchType: 'name' | 'category' | 'description' | 'partial' = 'partial';

      // Exact category match scores highest
      if (categoryMatch) {
        score = 1.0;
        matchType = 'category';
      }
      // Name match scores high
      else if (nameMatch) {
        score = 0.8;
        matchType = 'name';
        // Boost if starts with query
        if (symbol.name.toLowerCase().startsWith(lowerQuery)) {
          score = 0.9;
        }
      }
      // Description match scores lower
      else if (descMatch) {
        score = 0.5;
        matchType = 'description';
      }
      // Partial match on split words
      else if (this.hasPartialMatch(lowerQuery, symbol)) {
        score = 0.3;
        matchType = 'partial';
      }

      if (score > 0) {
        results.push({
          symbol,
          score,
          matchType,
          highlights: this.extractHighlights(lowerQuery, symbol),
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);

    // Add search to history
    this.searchHistory.unshift(query);
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory.pop();
    }

    return results.slice(0, limit);
  }

  /**
   * Search by category
   */
  searchByCategory(category: string, limit: number = 10): SearchResult[] {
    const results = this.symbols
      .filter(s => s.category?.toLowerCase() === category.toLowerCase())
      .map(symbol => ({
        symbol,
        score: 1.0,
        matchType: 'category' as const,
        highlights: [category],
      }));

    return results.slice(0, limit);
  }

  /**
   * Get recent symbols
   */
  getRecent(limit: number = 5): SearchResult[] {
    return this.recentSymbols
      .slice(0, limit)
      .map(symbol => ({
        symbol,
        score: 1.0,
        matchType: 'name' as const,
        highlights: [],
      }));
  }

  /**
   * Get favorite symbols
   */
  getFavorites(limit: number = 10): SearchResult[] {
    const results = this.symbols
      .filter(s => this.favoriteSymbols.has(s.id))
      .map(symbol => ({
        symbol,
        score: 1.0,
        matchType: 'name' as const,
        highlights: [],
      }));

    return results.slice(0, limit);
  }

  /**
   * Mark symbol as used (for recent list)
   */
  markAsUsed(symbol: Symbol): void {
    // Remove if already in list
    this.recentSymbols = this.recentSymbols.filter(s => s.id !== symbol.id);

    // Add to front
    this.recentSymbols.unshift(symbol);

    // Enforce size limit
    if (this.recentSymbols.length > this.maxRecentSize) {
      this.recentSymbols.pop();
    }
  }

  /**
   * Toggle favorite
   */
  toggleFavorite(symbolId: string): boolean {
    if (this.favoriteSymbols.has(symbolId)) {
      this.favoriteSymbols.delete(symbolId);
      return false;
    } else {
      this.favoriteSymbols.add(symbolId);
      return true;
    }
  }

  /**
   * Check if symbol is favorite
   */
  isFavorite(symbolId: string): boolean {
    return this.favoriteSymbols.has(symbolId);
  }

  /**
   * Get all categories
   */
  getCategories(): Array<{ name: string; count: number }> {
    const categoryMap = new Map<string, number>();

    for (const symbol of this.symbols) {
      if (symbol.category) {
        categoryMap.set(
          symbol.category,
          (categoryMap.get(symbol.category) || 0) + 1
        );
      }
    }

    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get search history
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
  }

  /**
   * Clear recent symbols
   */
  clearRecent(): void {
    this.recentSymbols = [];
  }

  /**
   * Update symbol list
   */
  updateSymbols(symbols: Symbol[]): void {
    this.symbols = symbols;
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): SearchResult[] {
    return this.symbols.map(symbol => ({
      symbol,
      score: 1.0,
      matchType: 'name' as const,
      highlights: [],
    }));
  }

  /**
   * Check for partial word match
   */
  private hasPartialMatch(query: string, symbol: Symbol): boolean {
    const queryWords = query.split(/\s+/);
    const nameWords = symbol.name.toLowerCase().split(/\s+/);

    for (const qWord of queryWords) {
      for (const nWord of nameWords) {
        if (nWord.includes(qWord) || qWord.includes(nWord)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract highlighted terms
   */
  private extractHighlights(query: string, symbol: Symbol): string[] {
    const highlights = new Set<string>();

    const checkString = (str: string) => {
      if (str.toLowerCase().includes(query)) {
        highlights.add(query);
      }
    };

    checkString(symbol.name);
    checkString(symbol.category || '');
    checkString(symbol.description || '');

    return Array.from(highlights);
  }

  /**
   * Get symbol by ID
   */
  getSymbolById(id: string): Symbol | undefined {
    return this.symbols.find(s => s.id === id);
  }

  /**
   * Get symbols by category
   */
  getSymbolsByCategory(category: string): Symbol[] {
    return this.symbols.filter(
      s => s.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Calculate statistics
   */
  getStats(): {
    totalSymbols: number;
    totalCategories: number;
    favoriteCount: number;
    recentCount: number;
    searchHistoryLength: number;
  } {
    const categories = new Set(this.symbols.map(s => s.category));

    return {
      totalSymbols: this.symbols.length,
      totalCategories: categories.size,
      favoriteCount: this.favoriteSymbols.size,
      recentCount: this.recentSymbols.length,
      searchHistoryLength: this.searchHistory.length,
    };
  }

  /**
   * Export favorites as JSON
   */
  exportFavoritesJSON(): string {
    const favorites = Array.from(this.favoriteSymbols);
    return JSON.stringify(favorites, null, 2);
  }

  /**
   * Import favorites from JSON
   */
  importFavoritesJSON(json: string): boolean {
    try {
      const favorites = JSON.parse(json) as string[];
      this.favoriteSymbols = new Set(favorites);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Helper function for fuzzy matching (for advanced search)
 */
export function fuzzyMatch(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  let score = 0;
  let queryIndex = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score++;
      queryIndex++;
    }
  }

  // Full match gives perfect score
  if (queryIndex === lowerQuery.length) {
    return score / lowerText.length;
  }

  return 0;
}
