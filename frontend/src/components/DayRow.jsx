import { useRef, useState, useEffect } from 'react';
import {
    Box, Button, HStack, Input, Popover, PopoverBody, PopoverContent,
    PopoverTrigger, Text, Tooltip, VStack,
} from '@chakra-ui/react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

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

const SEASON_LABELS = { SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall', WINTER: 'Winter' };

function getSeason(dateStr) {
    const m = new Date(dateStr + 'T00:00:00').getMonth() + 1;
    if (m >= 3 && m <= 5) return 'SPRING';
    if (m >= 6 && m <= 8) return 'SUMMER';
    if (m >= 9 && m <= 11) return 'FALL';
    return 'WINTER';
}

function getMealWarning(mealName, mealLibrary, weather, dateStr) {
    if (!mealName || !mealLibrary) return null;
    const meal = mealLibrary.find(m => m.name === mealName);
    if (!meal) return null;
    if (weather) {
        if (meal.maxTemp != null && weather.high > meal.maxTemp)
            return `Too hot — forecast high ${weather.high}°, max for this meal ${meal.maxTemp}°`;
        if (meal.minTemp != null && weather.high < meal.minTemp)
            return `Too cold — forecast high ${weather.high}°, min for this meal ${meal.minTemp}°`;
    }
    if (meal.seasons && meal.seasons.length > 0 && dateStr) {
        const season = getSeason(dateStr);
        if (!meal.seasons.includes(season)) {
            const suitable = meal.seasons.map(s => SEASON_LABELS[s] || s).join(', ');
            return `Out of season — suitable for ${suitable}`;
        }
    }
    return null;
}

function DayRow({ date, dateStr, dayName, entry, weather, mealSuggestions, mealLibrary, onSave, onOpenAiChat, onOpenDetail, onToggleConfirmed }) {
    const [mealName, setMealName] = useState(entry?.mealName || '');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [search, setSearch] = useState('');
    const searchRef = useRef(null);
    const listId = `suggestions-${dateStr}`;
    const isToday = dateStr === toLocalDateStr();
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dateStr });
    const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
        id: `day:${dateStr}`,
        disabled: !entry,
    });

    useEffect(() => {
        setMealName(entry?.mealName || '');
    }, [entry]);

    useEffect(() => {
        if (pickerOpen && searchRef.current) {
            setTimeout(() => searchRef.current?.focus(), 50);
        } else {
            setSearch('');
        }
    }, [pickerOpen]);

    const handleBlur = () => onSave(dateStr, dayName, mealName);
    const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };

    const pickMeal = (name) => {
        setMealName(name);
        setPickerOpen(false);
        onSave(dateStr, dayName, name);
    };

    const filtered = search.trim()
        ? mealSuggestions.filter(s => s.toLowerCase().includes(search.toLowerCase()))
        : mealSuggestions;

    const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <HStack
            ref={setDropRef}
            py={3}
            px={3}
            spacing={3}
            borderBottomWidth="1px"
            borderColor={isOver ? 'purple.300' : 'gray.100'}
            bg={isOver ? 'purple.50' : isToday ? 'blue.50' : 'transparent'}
            borderRadius="md"
            transition="background 0.15s, border-color 0.15s"
            opacity={isDragging ? 0.4 : 1}
        >
            <Box
                ref={setDragRef}
                minW="90px"
                cursor={entry ? 'grab' : 'default'}
                userSelect="none"
                {...(entry ? listeners : {})}
                {...(entry ? attributes : {})}
            >
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
                    fontStyle={entry && !entry.confirmed ? 'italic' : 'normal'}
                    color={entry && !entry.confirmed ? 'gray.400' : undefined}
                    _placeholder={{ color: 'gray.300' }}
                />
                {entry?.leftover && (
                    <Text fontSize="xs" color="orange.400" lineHeight="1.2" mt="1px">
                        ↩ {entry.leftoverFromDate
                            ? `leftovers from ${new Date(entry.leftoverFromDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                            : 'leftovers'}
                    </Text>
                )}
                {entry?.sides && (
                    <Text fontSize="xs" color="gray.500" lineHeight="1.2" mt="1px">
                        + {entry.sides}
                    </Text>
                )}
                {entry?.cookbookName && (
                    <Text fontSize="xs" color="gray.400" lineHeight="1.2" mt="1px">
                        {entry.cookbookName}
                    </Text>
                )}
                {(() => {
                    const warn = getMealWarning(entry?.mealName, mealLibrary, weather, dateStr);
                    return warn ? (
                        <Text fontSize="xs" color="red.400" lineHeight="1.2" mt="1px" title={warn}>
                            ⚠ {warn}
                        </Text>
                    ) : null;
                })()}
            </Box>

            {/* Confirmed toggle */}
            <Button
                size="xs"
                variant="ghost"
                colorScheme={entry?.confirmed ? 'green' : 'gray'}
                onClick={() => entry && onToggleConfirmed(entry)}
                isDisabled={!entry}
                title={entry?.confirmed ? 'Confirmed — click to mark as idea' : 'Idea — click to confirm'}
                px={1}
                opacity={entry ? 1 : 0}
            >
                {entry?.confirmed ? '✓' : '○'}
            </Button>

            {/* Browse meal history */}
            <Popover
                isOpen={pickerOpen}
                onClose={() => setPickerOpen(false)}
                placement="bottom-end"
                isLazy
            >
                <PopoverTrigger>
                    <Button
                        size="xs"
                        variant="ghost"
                        color="gray.400"
                        onClick={() => setPickerOpen(p => !p)}
                        title="Browse meal history"
                        px={1}
                    >
                        ☰
                    </Button>
                </PopoverTrigger>
                <PopoverContent w="220px" shadow="md">
                    <PopoverBody p={2}>
                        <Input
                            ref={searchRef}
                            placeholder="Search meals…"
                            size="xs"
                            mb={2}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <VStack align="stretch" spacing={0} maxH="200px" overflowY="auto">
                            {filtered.length === 0 && (
                                <Text fontSize="xs" color="gray.400" px={2} py={1}>No meals found</Text>
                            )}
                            {filtered.map(name => {
                                const warn = getMealWarning(name, mealLibrary, weather, dateStr);
                                return (
                                    <Box
                                        key={name}
                                        px={2}
                                        py={1}
                                        fontSize="sm"
                                        cursor="pointer"
                                        borderRadius="sm"
                                        color={warn ? 'gray.400' : undefined}
                                        _hover={{ bg: 'gray.100' }}
                                        onMouseDown={() => pickMeal(name)}
                                        title={warn || undefined}
                                    >
                                        {warn ? '⚠ ' : ''}{name}
                                    </Box>
                                );
                            })}
                        </VStack>
                    </PopoverBody>
                </PopoverContent>
            </Popover>

            {/* Edit / Add New detail form */}
            <Popover placement="bottom-end" isLazy>
                <PopoverTrigger>
                    <Button size="xs" variant="ghost" color="gray.400" title="Edit or add meal" px={1}>
                        ⋯
                    </Button>
                </PopoverTrigger>
                <PopoverContent w="110px" shadow="md">
                    <PopoverBody p={1}>
                        <VStack align="stretch" spacing={0}>
                            {entry && (
                                <Box
                                    px={2} py={1} fontSize="sm" cursor="pointer" borderRadius="sm"
                                    _hover={{ bg: 'gray.100' }}
                                    onMouseDown={() => onOpenDetail('edit')}
                                >
                                    Edit
                                </Box>
                            )}
                            <Box
                                px={2} py={1} fontSize="sm" cursor="pointer" borderRadius="sm"
                                _hover={{ bg: 'gray.100' }}
                                onMouseDown={() => onOpenDetail('add')}
                            >
                                Add New
                            </Box>
                        </VStack>
                    </PopoverBody>
                </PopoverContent>
            </Popover>

            {/* AI meal chat */}
            <Button
                size="xs"
                variant="ghost"
                color="purple.300"
                onClick={() => { setPickerOpen(false); onOpenAiChat(); }}
                title={`Get meal ideas for ${dayName}`}
                px={1}
            >
                ✨
            </Button>

            <Box minW="85px" textAlign="right">
                {weather ? (
                    <Tooltip label="Weather is approximate and for meal planning purposes only" fontSize="xs" placement="left">
                        <Text fontSize="sm" color="gray.600" whiteSpace="nowrap" cursor="default">
                            {weatherIcon(weather.condition)} {weather.high}°/{weather.low}°
                        </Text>
                    </Tooltip>
                ) : (
                    <Text fontSize="sm" color="gray.200">—</Text>
                )}
            </Box>
        </HStack>
    );
}

export default DayRow;
