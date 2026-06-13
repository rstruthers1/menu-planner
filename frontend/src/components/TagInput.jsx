import { useState, useRef, useEffect } from 'react';
import { Box, HStack, Input, Tag, TagCloseButton, TagLabel } from '@chakra-ui/react';
import { authFetch } from '../utils/api';

function TagInput({ value, onChange, placeholder, suggestionsUrl }) {
    const [inputVal, setInputVal] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!inputVal.trim() || !suggestionsUrl) {
            setSuggestions([]);
            return;
        }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            authFetch(`${suggestionsUrl}?q=${encodeURIComponent(inputVal.trim())}`)
                .then(r => r.json())
                .then(data => setSuggestions(data.filter(s => !value.includes(s))))
                .catch(() => setSuggestions([]));
        }, 200);
        return () => clearTimeout(debounceRef.current);
    }, [inputVal, suggestionsUrl]);

    const addTag = (tag) => {
        const trimmed = tag.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
        }
        setInputVal('');
        setSuggestions([]);
    };

    const removeTag = (tag) => onChange(value.filter(t => t !== tag));

    const handleKeyDown = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && inputVal.trim()) {
            e.preventDefault();
            addTag(inputVal);
        }
        if (e.key === 'Backspace' && !inputVal && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <Box>
            {value.length > 0 && (
                <HStack flexWrap="wrap" spacing={1} mb={2}>
                    {value.map(tag => (
                        <Tag key={tag} size="sm" colorScheme="teal" borderRadius="full">
                            <TagLabel>{tag}</TagLabel>
                            <TagCloseButton onClick={() => removeTag(tag)} />
                        </Tag>
                    ))}
                </HStack>
            )}
            <Box position="relative">
                <Input
                    size="sm"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={placeholder}
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
                                onMouseDown={() => addTag(s)}
                            >
                                {s}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

export default TagInput;
