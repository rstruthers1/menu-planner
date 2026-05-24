import { useState, useEffect } from 'react';
import { Box, HStack, Input, Text } from '@chakra-ui/react';

function weatherIcon(condition) {
    if (!condition) return '';
    const c = condition.toLowerCase();
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
    if (c.includes('fog')) return '🌫️';
    if (c.includes('overcast')) return '☁️';
    if (c.includes('partly') || c.includes('mainly clear')) return '⛅';
    if (c.includes('clear')) return '☀️';
    return '🌤️';
}

function toLocalDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function DayRow({ date, dateStr, dayName, entry, weather, mealSuggestions, onSave }) {
    const [mealName, setMealName] = useState(entry?.mealName || '');
    const listId = `suggestions-${dateStr}`;
    const isToday = dateStr === toLocalDateStr();

    useEffect(() => {
        setMealName(entry?.mealName || '');
    }, [entry]);

    const handleBlur = () => onSave(dateStr, dayName, mealName, weather);
    const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };

    const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <HStack
            py={3}
            px={3}
            spacing={3}
            borderBottomWidth="1px"
            borderColor="gray.100"
            bg={isToday ? 'blue.50' : 'transparent'}
            borderRadius="md"
        >
            <Box minW="90px">
                <Text fontWeight="semibold" fontSize="sm" color={isToday ? 'blue.600' : 'gray.700'}>
                    {dayName.slice(0, 3)}
                </Text>
                <Text fontSize="xs" color="gray.400">{dateLabel}</Text>
            </Box>

            <Box flex={1}>
                <datalist id={listId}>
                    {mealSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
                <Input
                    list={listId}
                    value={mealName}
                    onChange={e => setMealName(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a meal…"
                    size="sm"
                    variant="flushed"
                    _placeholder={{ color: 'gray.300' }}
                />
            </Box>

            <Box minW="85px" textAlign="right">
                {weather ? (
                    <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">
                        {weatherIcon(weather.condition)} {weather.high}°/{weather.low}°
                    </Text>
                ) : (
                    <Text fontSize="sm" color="gray.200">—</Text>
                )}
            </Box>
        </HStack>
    );
}

export default DayRow;
