import { useState } from 'react';
import {
    Box, Button, Checkbox, CheckboxGroup, HStack, NumberInput, NumberInputField,
    Spinner, Text, VStack, Wrap, WrapItem,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import { COOK_METHODS } from '../utils/mealConstants';

function SuggestPanel({ weekStart, weather, entries, toDateStr, onSuggestions }) {
    const [noRepeatDays, setNoRepeatDays] = useState(14);
    const [seasonMatch, setSeasonMatch] = useState(true);
    const [weatherMatch, setWeatherMatch] = useState(true);
    const [excludeMethods, setExcludeMethods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSuggest = () => {
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
        entries.forEach(e => { if (e.mealName) existingMeals[e.mealDate] = e.mealName; });

        authFetch('/api/suggest-meals/rules', {
            method: 'POST',
            body: JSON.stringify({
                weekStart: toDateStr(weekStart),
                existingMeals,
                weather: weatherMap,
                rules: { noRepeatDays, seasonMatch, weatherMatch, excludeMethods },
                targetDate: null,
            }),
        })
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(onSuggestions)
            .catch(() => setError('Could not get suggestions.'))
            .finally(() => setLoading(false));
    };

    return (
        <Box mb={5} p={4} bg="blue.50" borderRadius="lg" borderWidth="1px" borderColor="blue.100">
            <Text fontSize="sm" fontWeight="semibold" color="blue.700" mb={3}>
                Need help planning?
            </Text>
            <VStack align="stretch" spacing={3}>
                <HStack spacing={4} flexWrap="wrap">
                    <HStack spacing={1}>
                        <Text fontSize="xs" color="blue.600" whiteSpace="nowrap">No repeat within</Text>
                        <NumberInput
                            size="xs"
                            min={0}
                            max={365}
                            value={noRepeatDays}
                            onChange={(_, n) => setNoRepeatDays(isNaN(n) ? 14 : n)}
                            w="60px"
                            keepWithinRange
                            clampValueOnBlur
                        >
                            <NumberInputField />
                        </NumberInput>
                        <Text fontSize="xs" color="blue.600">days</Text>
                    </HStack>
                    <Checkbox
                        size="sm"
                        isChecked={seasonMatch}
                        onChange={e => setSeasonMatch(e.target.checked)}
                        colorScheme="blue"
                    >
                        <Text fontSize="xs">Season</Text>
                    </Checkbox>
                    <Checkbox
                        size="sm"
                        isChecked={weatherMatch}
                        onChange={e => setWeatherMatch(e.target.checked)}
                        colorScheme="blue"
                    >
                        <Text fontSize="xs">Weather</Text>
                    </Checkbox>
                </HStack>
                <Box>
                    <Text fontSize="xs" color="blue.600" mb={1}>Avoid cooking methods this week:</Text>
                    <CheckboxGroup value={excludeMethods} onChange={setExcludeMethods} colorScheme="red">
                        <Wrap spacing={2}>
                            {COOK_METHODS.map(m => (
                                <WrapItem key={m.value}>
                                    <Checkbox value={m.value} size="sm">
                                        <Text fontSize="xs">{m.label}</Text>
                                    </Checkbox>
                                </WrapItem>
                            ))}
                        </Wrap>
                    </CheckboxGroup>
                    <Text fontSize="xs" color="gray.400" mt={1}>Weekend-only meals are skipped Mon–Fri automatically.</Text>
                </Box>
                <HStack>
                    <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={handleSuggest}
                        isLoading={loading}
                        spinner={<Spinner size="xs" />}
                    >
                        Suggest meals
                    </Button>
                    {error && <Text fontSize="xs" color="red.500">{error}</Text>}
                </HStack>
            </VStack>
        </Box>
    );
}

export default SuggestPanel;
