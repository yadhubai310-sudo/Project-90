import { addRecord, getAll, newId } from './db.js';

const SEED = [
  { category: 'Physical health', name: 'Workout', slots: ['ANYTIME'] },
  { category: 'Physical health', name: 'Walking / skipping', slots: ['ANYTIME'] },
  { category: 'Physical health', name: 'Stretching', slots: ['ANYTIME'] },
  { category: 'Physical health', name: 'Sleep tracking', slots: ['NIGHT'] },
  { category: 'Face care', name: 'Skincare', slots: ['MORNING', 'NIGHT'] },
  { category: 'Face care', name: 'Sunscreen', slots: ['MORNING'] },
  {
    category: 'Hair care', name: 'Hair washing', slots: ['ANYTIME'],
    frequencyType: 'X_PER_WEEK', frequencyCount: 3,
  },
  { category: 'Hair care', name: 'Conditioning', slots: ['ANYTIME'] },
  { category: 'Hair care', name: 'Hair maintenance', slots: ['ANYTIME'] },
  { category: 'Nutrition', name: 'Breakfast', slots: ['MORNING'] },
  { category: 'Nutrition', name: 'Lunch', slots: ['ANYTIME'] },
  { category: 'Nutrition', name: 'Dinner', slots: ['NIGHT'] },
  { category: 'Nutrition', name: 'Fruit & vegetables', slots: ['ANYTIME'] },
  { category: 'Nutrition', name: 'Water intake', slots: ['ANYTIME'], target: 8 },
  { category: 'Personal style', name: 'Outfit planning', slots: ['MORNING'] },
  { category: 'Personal style', name: 'Personal hygiene', slots: ['MORNING', 'NIGHT'] },
  { category: 'Personal style', name: 'Wardrobe maintenance', slots: ['ANYTIME'] },
];

export async function seedIfEmpty() {
  const existing = await getAll('habits');
  if (existing.length > 0) return;

  const now = Date.now();
  for (let i = 0; i < SEED.length; i++) {
    const def = SEED[i];
    const habitId = newId();
    await addRecord('habits', {
      id: habitId, name: def.name, category: def.category,
      sortOrder: i, archived: false, createdAt: now, updatedAt: now,
    });
    for (const slotType of def.slots) {
      await addRecord('habitSlots', {
        id: newId(), habitId, slotType,
        target: def.target || 1,
        frequencyType: def.frequencyType || 'DAILY',
        frequencyDays: null,
        frequencyCount: def.frequencyCount || null,
        activeFrom: now, activeTo: null,
        createdAt: now, updatedAt: now,
      });
    }
  }
}
