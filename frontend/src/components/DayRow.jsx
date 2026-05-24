import { useRef, useState, useEffect } from 'react';
import {
    Box, Button, HStack, Input, Popover, PopoverBody, PopoverContent,
    PopoverTrigger, Spinner, Text, VStack,
} from '@chakra-ui/react';

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

function DayRow({ date, dateStr, dayName, entry, weather, mealSuggestions, onSave, onAskAI }) {
    const [mealName, setMealName] = useState(entry?.mealName || '');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [search, setSearch] = useState('');
    const searchRef = useRef(null);
    const aiInputRef = useRef(null);
    const listId = `suggestions-${dateStr}`;
    const isToday = dateStr === toLocalDateStr();

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

    useEffect(() => {
        if (aiOpen && aiInputRef.current) {
            setTimeout(() => aiInputRef.current?.focus(), 50);
        } else {
            setAiPrompt('');
        }
    }, [aiOpen]);

    const handleBlur = () => onSave(dateStr, dayName, mealName, weather);
    const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };

    const pickMeal = (name) => {
        setMealName(name);
        setPickerOpen(false);
        onSave(dateStr, dayName, name, weather);
    };

    const handleAskAI = () => {
        if (!aiPrompt.trim()) return;
        setAiLoading(true);
        onAskAI(dateStr, dayName, aiPrompt.trim());
        // Close after a short delay — the save will update the entry
        setTimeout(() => {
            setAiLoading(false);
            setAiOpen(false);
        }, 3000);
    };

    const filtered = search.trim()
        ? mealSuggestions.filter(s => s.toLowerCase().includes(search.toLowerCase()))
        : mealSuggestions;

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
                        onClick={() => { setAiOpen(false); setPickerOpen(p => !p); }}
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
                            {filtered.map(name => (
                                <Box
                                    key={name}
                                    px={2}
                                    py={1}
                                    fontSize="sm"
                                    cursor="pointer"
                                    borderRadius="sm"
                                    _hover={{ bg: 'gray.100' }}
                                    onMouseDown={() => pickMeal(name)}
                                >
                                    {name}
                                </Box>
                            ))}
                        </VStack>
                    </PopoverBody>
                </PopoverContent>
            </Popover>

            {/* Ask AI for this day */}
            <Popover
                isOpen={aiOpen}
                onClose={() => setAiOpen(false)}
                placement="bottom-end"
                isLazy
            >
                <PopoverTrigger>
                    <Button
                        size="xs"
                        variant="ghost"
                        color="purple.300"
                        onClick={() => { setPickerOpen(false); setAiOpen(p => !p); }}
                        title={`Get a suggestion for ${dayName}`}
                        px={1}
                    >
                        ✨
                    </Button>
                </PopoverTrigger>
                <PopoverContent w="230px" shadow="md">
                    <PopoverBody p={3}>
                        <Text fontSize="xs" color="gray.500" mb={2}>
                            What do you want for {dayName}?
                        </Text>
                        <Input
                            ref={aiInputRef}
                            placeholder="e.g. something super easy"
                            size="sm"
                            mb={2}
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAskAI(); }}
                        />
                        <Button
                            size="sm"
                            colorScheme="purple"
                            width="100%"
                            onClick={handleAskAI}
                            isDisabled={!aiPrompt.trim() || aiLoading}
                        >
                            {aiLoading ? <Spinner size="xs" /> : 'Suggest'}
                        </Button>
                    </PopoverBody>
                </PopoverContent>
            </Popover>

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
