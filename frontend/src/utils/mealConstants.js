export const COOK_METHODS = [
    { value: 'GRILL', label: 'Grill' },
    { value: 'INDOOR_GRILL', label: 'Indoor Grill' },
    { value: 'OVEN', label: 'Oven' },
    { value: 'STOVE', label: 'Stovetop' },
    { value: 'SLOW_COOKER', label: 'Slow Cooker' },
    { value: 'AIR_FRYER', label: 'Air Fryer' },
    { value: 'INSTANT_POT', label: 'Instant Pot' },
    { value: 'NO_COOK', label: 'No Cook' },
];

export const COOK_METHOD_LABELS = Object.fromEntries(COOK_METHODS.map(m => [m.value, m.label]));
