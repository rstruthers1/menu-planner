import { useState, useRef, useEffect } from 'react';
import { Box, Button, HStack, Input, VStack } from '@chakra-ui/react';
import { authFetch } from '../utils/api';

function IngredientRow({ value, onChange, onRemove, onAddNext, suggestionsUrl, autoFocus }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
        const q = value.trim();
        if (!q || !suggestionsUrl) { setSuggestions([]); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            authFetch(`${suggestionsUrl}?q=${encodeURIComponent(q)}`)
                .then(r => r.json())
                .then(data => setSuggestions(Array.isArray(data) ? data.filter(s => s.toLowerCase() !== q.toLowerCase()) : []))
                .catch(() => setSuggestions([]));
        }, 200);
        return () => clearTimeout(debounceRef.current);
    }, [value, suggestionsUrl]);

    const pick = (name) => {
        onChange(name);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onAddNext(); }
        if (e.key === 'Backspace' && !value) onRemove();
    };

    return (
        <HStack spacing={2} align="center">
            <Box flex={1} position="relative">
                <Input
                    ref={inputRef}
                    size="sm"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="e.g. 2 cups flour"
                />
                {showSuggestions && suggestions.length > 0 && (
                    <Box
                        position="absolute"
                        top="100%"
                        left={0}
                        right={0}
                        bg="white"
                        border="1px"
                        borderColor="gray.200"
                        borderRadius="md"
                        shadow="sm"
                        zIndex={10}
                        maxH="150px"
                        overflowY="auto"
                    >
                        {suggestions.map(s => (
                            <Box
                                key={s}
                                px={3}
                                py={1}
                                fontSize="sm"
                                cursor="pointer"
                                _hover={{ bg: 'gray.50' }}
                                onMouseDown={() => pick(s)}
                            >
                                {s}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
            <Button size="xs" variant="ghost" colorScheme="red" onClick={onRemove} tabIndex={-1} px={1}>
                ×
            </Button>
        </HStack>
    );
}

function IngredientRows({ value, onChange, suggestionsUrl }) {
    const [focusIdx, setFocusIdx] = useState(null);
    const rows = value.length > 0 ? value : [''];

    const update = (i, text) => {
        const next = [...rows];
        next[i] = text;
        onChange(next);
    };

    const remove = (i) => {
        if (rows.length === 1) { onChange(['']); return; }
        const next = rows.filter((_, idx) => idx !== i);
        onChange(next);
        setFocusIdx(Math.min(i, next.length - 1));
    };

    const addNext = (i) => {
        const next = [...rows.slice(0, i + 1), '', ...rows.slice(i + 1)];
        onChange(next);
        setFocusIdx(i + 1);
    };

    const addRow = () => {
        onChange([...rows, '']);
        setFocusIdx(rows.length);
    };

    return (
        <VStack align="stretch" spacing={1}>
            {rows.map((row, i) => (
                <IngredientRow
                    key={i}
                    value={row}
                    onChange={text => update(i, text)}
                    onRemove={() => remove(i)}
                    onAddNext={() => addNext(i)}
                    suggestionsUrl={suggestionsUrl}
                    autoFocus={focusIdx === i}
                />
            ))}
            <Button size="xs" variant="ghost" colorScheme="gray" alignSelf="flex-start" onClick={addRow}>
                + add ingredient
            </Button>
        </VStack>
    );
}

export default IngredientRows;
