import { ItemDatabase, Rarity } from '../data/ItemDatabase';
import * as fs from 'fs';
import * as path from 'path';

export class LootEngine {
  private static dropRates = {
    basic: 18.0,
    epic: 1.5,
    legendary: 0.5,
    none: 80.0
  };

  public static loadRates(): void {
    let filePath = path.resolve(__dirname, '../../../client/item_drop_rates.json');
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve(__dirname, '../../public/item_drop_rates.json');
    }

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (typeof data.basic === 'number' && typeof data.epic === 'number' && typeof data.legendary === 'number') {
          this.dropRates.basic = data.basic;
          this.dropRates.epic = data.epic;
          this.dropRates.legendary = data.legendary;
          this.dropRates.none = Math.max(0, 100 - (data.basic + data.epic + data.legendary));
          console.log(`[LootEngine] Loaded dynamic drop rates: basic=${this.dropRates.basic}%, epic=${this.dropRates.epic}%, legendary=${this.dropRates.legendary}%, none=${this.dropRates.none}%`);
        }
      } catch (err: any) {
        console.error('[LootEngine] Failed to parse item_drop_rates.json:', err.message);
      }
    } else {
      console.warn(`[LootEngine] Drop rates config file not found at ${filePath}, using defaults.`);
    }
  }

  /**
   * Calculates the loot drop based on the duration of the match.
   * Returns the item ID if a drop occurred, or null if no drop.
   * @param matchDurationMinutes The duration of the match in minutes.
   */
  public static calculateDrop(matchDurationMinutes: number): string | null {
    const bonusDrop = Math.floor(matchDurationMinutes / 10);
    
    // Base Rates loaded dynamically
    let noneRate = this.dropRates.none;
    let basicRate = this.dropRates.basic;
    let epicRate = this.dropRates.epic;
    let legendaryRate = this.dropRates.legendary;

    // Apply scaling
    noneRate = Math.max(0, noneRate - bonusDrop);
    basicRate = basicRate + bonusDrop;

    // Roll dice between 0.00 and 100.00
    const roll = Math.random() * 100;

    let rarityDropped: Rarity | null = null;

    if (roll <= legendaryRate) {
      rarityDropped = 'legendary';
    } else if (roll <= legendaryRate + epicRate) {
      rarityDropped = 'epic';
    } else if (roll <= legendaryRate + epicRate + basicRate) {
      rarityDropped = 'basic';
    }

    if (!rarityDropped) {
      return null;
    }

    // Pick a random item from the dropped rarity
    const availableItems = Object.values(ItemDatabase).filter(item => item.rarity === rarityDropped);
    if (availableItems.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * availableItems.length);
    return availableItems[randomIndex].id;
  }
}
