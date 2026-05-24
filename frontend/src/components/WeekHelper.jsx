import { useState } from 'react';
import {
    Box, Button, HStack, Spinner, Text, Textarea, VStack,
} from '@chakra-ui/react';

function WeekHelper({ weekStart, weather, entries, toDateStr, onSuggestions }) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSuggest = () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError('');

        const weatherMap = {};
        Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = toDateStr(d);
            if (weather[dateStr]) weatherMap[dateStr] = weather[dateStr];
        });

        const existingMeals = {};
        entries.forEach(e => {
            if (e.mealName) existingMeals[e.mealDate] = e.mealName;
        });

        fetch('/api/suggest-meals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weekStart: toDateStr(weekStart),
                prompt: prompt.trim(),
                weather: weatherMap,
                existingMeals,
                targetDate: null,
            }),
        })
            .then(r => {
                if (!r.ok) throw new Error('Request failed');
                return r.json();
            })
            .then(suggestions => {
                onSuggestions(suggestions);
                setPrompt('');
            })
            .catch(() => setError('Could not get suggestions. Check that ANTHROPIC_API_KEY is set.'))
            .finally(() => setLoading(false));
    };

    return (
        <Box mb={5} p={4} bg="purple.50" borderRadius="lg" borderWidth="1px" borderColor="purple.100">
            <Text fontSize="sm" fontWeight="semibold" color="purple.700" mb={2}>
                Need help planning?
            </Text>
            <Text fontSize="xs" color="purple.500" mb={3}>
                Describe your week and get meal ideas from your history. Empty days will be filled in.
            </Text>
            <VStack align="stretch" spacing={2}>
                <Textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. Hot week, Tuesday needs to be really quick, Saturday is date night"
                    size="sm"
                    rows={2}
                    resize="none"
                    bg="white"
                    borderColor="purple.200"
                    _focus={{ borderColor: 'purple.400', boxShadow: 'none' }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSuggest(); } }}
                />
                <HStack>
                    <Button
                        size="sm"
                        colorScheme="purple"
                        onClick={handleSuggest}
                        isLoading={loading}
                        spinner={<Spinner size="xs" />}
                        isDisabled={!prompt.trim()}
                    >
                        Suggest meals
                    </Button>
                    {error && <Text fontSize="xs" color="red.500">{error}</Text>}
                </HStack>
            </VStack>
        </Box>
    );
}

export default WeekHelper;
