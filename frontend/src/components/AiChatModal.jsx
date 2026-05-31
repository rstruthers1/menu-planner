import { useState, useEffect, useRef } from 'react';
import {
    Box, Button, HStack, Input, Modal, ModalBody, ModalCloseButton,
    ModalContent, ModalHeader, ModalOverlay, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

const INIT_PROMPT = 'Suggest some meal options for me.';

function AiChatModal({ isOpen, onClose, dateStr, dayName, weather, existingMeals, mealLibrary, weekStart, onSelect }) {
    // messages: what's shown in UI (no hidden initial user bubble)
    const [messages, setMessages] = useState([]);
    // apiHistory: full exchange history sent to the API (includes hidden initial prompt)
    const [apiHistory, setApiHistory] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setMessages([]);
            setApiHistory([]);
            setInput('');
            return;
        }

        // Auto-trigger initial suggestions on open
        const initHistory = [{ role: 'user', content: INIT_PROMPT }];
        setLoading(true);
        setTimeout(() => inputRef.current?.focus(), 50);

        authFetch('/api/suggest-meals/chat', {
            method: 'POST',
            body: JSON.stringify({
                targetDate: dateStr,
                dayName,
                weekStart,
                weather,
                existingMeals,
                mealLibrary,
                messages: initHistory,
            }),
        })
            .then(r => r.json())
            .then(data => {
                const assistantMsg = {
                    role: 'assistant',
                    text: data.message || '',
                    suggestions: data.suggestions || [],
                };
                setMessages([assistantMsg]);
                setApiHistory([...initHistory, { role: 'assistant', content: data.message || '' }]);
            })
            .catch(() => {
                setMessages([{ role: 'assistant', text: 'Could not load suggestions. Try typing a request below.', suggestions: [] }]);
            })
            .finally(() => setLoading(false));
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userApiMsg = { role: 'user', content: text };
        const newApiHistory = [...apiHistory, userApiMsg];

        setMessages(prev => [...prev, { role: 'user', text }]);
        setInput('');
        setLoading(true);

        try {
            const r = await authFetch('/api/suggest-meals/chat', {
                method: 'POST',
                body: JSON.stringify({
                    targetDate: dateStr,
                    dayName,
                    weekStart,
                    weather,
                    existingMeals,
                    mealLibrary,
                    messages: newApiHistory,
                }),
            });
            const data = await r.json();
            const assistantMsg = {
                role: 'assistant',
                text: data.message || '',
                suggestions: data.suggestions || [],
            };
            setMessages(prev => [...prev, assistantMsg]);
            setApiHistory([...newApiHistory, { role: 'assistant', content: data.message || '' }]);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: 'Something went wrong. Please try again.',
                suggestions: [],
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const displayDate = dateStr
        ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : '';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">Meal ideas — {displayDate}</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={4}>
                    {/* Chat history */}
                    <VStack
                        align="stretch"
                        spacing={3}
                        minH="200px"
                        maxH="420px"
                        overflowY="auto"
                        mb={3}
                        pr={1}
                    >
                        {loading && messages.length === 0 && (
                            <HStack spacing={2} color="gray.400" pt={2}>
                                <Spinner size="xs" color="purple.400" />
                                <Text fontSize="sm">Finding ideas…</Text>
                            </HStack>
                        )}
                        {messages.map((msg, i) => (
                            <Box key={i}>
                                {msg.role === 'user' ? (
                                    <Box display="flex" justifyContent="flex-end">
                                        <Box bg="blue.50" borderRadius="lg" px={3} py={2} maxW="85%">
                                            <Text fontSize="sm">{msg.text}</Text>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box>
                                        {msg.text && (
                                            <Text fontSize="sm" color="gray.600" mb={msg.suggestions?.length ? 2 : 0}>
                                                {msg.text}
                                            </Text>
                                        )}
                                        <VStack spacing={2} align="stretch">
                                            {msg.suggestions?.map((s, j) => (
                                                <Box
                                                    key={j}
                                                    borderWidth="1px"
                                                    borderRadius="md"
                                                    px={3}
                                                    py={3}
                                                    cursor="pointer"
                                                    transition="all 0.1s"
                                                    _hover={{ bg: 'purple.50', borderColor: 'purple.200', shadow: 'sm' }}
                                                    onClick={() => { onSelect(s.name); onClose(); }}
                                                >
                                                    <HStack justify="space-between" align="flex-start">
                                                        <Text fontSize="sm" fontWeight="semibold" lineHeight="1.3">
                                                            {s.name}
                                                        </Text>
                                                        <Text fontSize="xs" color="purple.400" fontWeight="medium" flexShrink={0} mt="1px">
                                                            Select →
                                                        </Text>
                                                    </HStack>
                                                    {s.reason && (
                                                        <Text fontSize="xs" color="gray.500" mt={1} lineHeight="1.4">
                                                            {s.reason}
                                                        </Text>
                                                    )}
                                                </Box>
                                            ))}
                                        </VStack>
                                    </Box>
                                )}
                            </Box>
                        ))}
                        {loading && messages.length > 0 && (
                            <HStack spacing={2} color="gray.400">
                                <Spinner size="xs" color="purple.400" />
                                <Text fontSize="sm">Thinking…</Text>
                            </HStack>
                        )}
                        <div ref={bottomRef} />
                    </VStack>

                    {/* Refinement input */}
                    <HStack>
                        <Input
                            ref={inputRef}
                            placeholder={'Refine… e.g. "make it vegetarian", "something lighter"'}
                            size="sm"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            isDisabled={loading}
                        />
                        <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={send}
                            isDisabled={!input.trim() || loading}
                            flexShrink={0}
                        >
                            Send
                        </Button>
                    </HStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

export default AiChatModal;
