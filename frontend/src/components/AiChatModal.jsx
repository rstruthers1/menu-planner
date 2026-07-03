import { useState, useEffect, useRef } from 'react';
import {
    Box, Button, HStack, Input, Modal, ModalBody, ModalCloseButton,
    ModalContent, ModalHeader, ModalOverlay, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

const INIT_PROMPT = 'Suggest some meal options for me.';
const REEL_COUNT = 3;

function SlotReel({ items, finalValue, stopped, stopDelay, onPick }) {
    const [current, setCurrent] = useState(items.length > 0 ? items[Math.floor(Math.random() * items.length)] : '–');
    const [settled, setSettled] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        setSettled(false);
        if (stopped) {
            clearInterval(intervalRef.current);
            const t = setTimeout(() => {
                setCurrent(finalValue || '–');
                setSettled(true);
            }, stopDelay);
            return () => clearTimeout(t);
        }
        if (items.length === 0) return;
        intervalRef.current = setInterval(() => {
            setCurrent(items[Math.floor(Math.random() * items.length)]);
        }, 80);
        return () => clearInterval(intervalRef.current);
    }, [stopped]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Box
            flex={1}
            h="64px"
            overflow="hidden"
            borderWidth="2px"
            borderColor={settled ? 'purple.400' : 'gray.200'}
            borderRadius="md"
            bg={settled ? 'purple.50' : 'gray.100'}
            display="flex"
            alignItems="center"
            justifyContent="center"
            transition="border-color 0.35s, background 0.35s"
            px={2}
            boxShadow={settled ? 'sm' : 'none'}
            cursor={settled ? 'pointer' : 'default'}
            _hover={settled ? { bg: 'purple.100', borderColor: 'purple.500' } : {}}
            onClick={settled ? () => onPick(current) : undefined}
        >
            <Text
                fontSize="xs"
                fontWeight={settled ? 'bold' : 'normal'}
                color={settled ? 'purple.700' : 'gray.500'}
                textAlign="center"
                noOfLines={2}
                lineHeight="1.3"
                transition="color 0.3s, font-weight 0.3s"
                userSelect="none"
            >
                {current}
            </Text>
        </Box>
    );
}

function SlotMachine({ spinning, suggestions, mealLibrary, onSelect, onClose }) {
    const [allSettled, setAllSettled] = useState(false);

    useEffect(() => {
        if (spinning) { setAllSettled(false); return; }
        const lastStopDelay = 300 + (REEL_COUNT - 1) * 500;
        const t = setTimeout(() => setAllSettled(true), lastStopDelay + 450);
        return () => clearTimeout(t);
    }, [spinning]);

    return (
        <Box>
            <Text fontSize="xs" color="gray.400" textAlign="center" mb={2}>
                {spinning ? 'Spinning…' : allSettled ? 'Tap a tile to pick' : ''}
            </Text>
            <HStack spacing={2}>
                {Array.from({ length: REEL_COUNT }, (_, i) => (
                    <SlotReel
                        key={i}
                        items={mealLibrary}
                        finalValue={suggestions[i]?.name || ''}
                        stopped={!spinning}
                        stopDelay={300 + i * 500}
                        onPick={(name) => { onSelect(name); onClose(); }}
                    />
                ))}
            </HStack>
        </Box>
    );
}

function AiChatModal({ isOpen, onClose, dateStr, dayName, weather, existingMeals, mealLibrary, weekStart, onSelect }) {
    const [messages, setMessages] = useState([]);
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

        const initHistory = [{ role: 'user', content: INIT_PROMPT }];
        setLoading(true);
        setTimeout(() => inputRef.current?.focus(), 50);

        authFetch('/api/suggest-meals/chat', {
            method: 'POST',
            body: JSON.stringify({ targetDate: dateStr, dayName, weekStart, weather, existingMeals, mealLibrary, messages: initHistory }),
        })
            .then(r => r.json())
            .then(data => {
                setMessages([{ role: 'assistant', text: data.message || '', suggestions: data.suggestions || [] }]);
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
                body: JSON.stringify({ targetDate: dateStr, dayName, weekStart, weather, existingMeals, mealLibrary, messages: newApiHistory }),
            });
            const data = await r.json();
            setMessages(prev => [...prev, { role: 'assistant', text: data.message || '', suggestions: data.suggestions || [] }]);
            setApiHistory([...newApiHistory, { role: 'assistant', content: data.message || '' }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again.', suggestions: [] }]);
        } finally {
            setLoading(false);
        }
    };

    const spinWheel = () => {
        if (loading) return;
        const spinMsg = { role: 'user', content: 'Spin the wheel — give me a completely different set of meal suggestions.' };
        const newApiHistory = [...apiHistory, spinMsg];
        setMessages(prev => [...prev,
            { role: 'user', text: '🎰 Spin the wheel' },
            { role: 'slot', spinning: true, suggestions: [] },
        ]);
        setApiHistory(newApiHistory);
        setLoading(true);

        authFetch('/api/suggest-meals/chat', {
            method: 'POST',
            body: JSON.stringify({ targetDate: dateStr, dayName, weekStart, weather, existingMeals, mealLibrary, messages: newApiHistory }),
        })
            .then(r => r.json())
            .then(data => {
                setMessages(prev => prev.map(m =>
                    m.role === 'slot' && m.spinning
                        ? { ...m, spinning: false, suggestions: data.suggestions || [] }
                        : m
                ));
                setApiHistory(h => [...h, { role: 'assistant', content: data.message || '' }]);
            })
            .catch(() => {
                setMessages(prev => prev.map(m =>
                    m.role === 'slot' && m.spinning ? { ...m, spinning: false, suggestions: [] } : m
                ));
            })
            .finally(() => setLoading(false));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const hasActiveSlot = messages.some(m => m.role === 'slot');

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
                    <VStack align="stretch" spacing={3} minH="200px" maxH="420px" overflowY="auto" mb={3} pr={1}>
                        {loading && messages.length === 0 && (
                            <HStack spacing={2} color="gray.400" pt={2}>
                                <Spinner size="xs" color="purple.400" />
                                <Text fontSize="sm">Finding ideas…</Text>
                            </HStack>
                        )}
                        {messages.map((msg, i) => (
                            <Box key={i}>
                                {msg.role === 'user' && (
                                    <Box display="flex" justifyContent="flex-end">
                                        <Box bg="blue.50" borderRadius="lg" px={3} py={2} maxW="85%">
                                            <Text fontSize="sm">{msg.text}</Text>
                                        </Box>
                                    </Box>
                                )}
                                {msg.role === 'assistant' && (
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
                                                        <Text fontSize="sm" fontWeight="semibold" lineHeight="1.3">{s.name}</Text>
                                                        <Text fontSize="xs" color="purple.400" fontWeight="medium" flexShrink={0} mt="1px">Select →</Text>
                                                    </HStack>
                                                    {s.reason && (
                                                        <Text fontSize="xs" color="gray.500" mt={1} lineHeight="1.4">{s.reason}</Text>
                                                    )}
                                                </Box>
                                            ))}
                                        </VStack>
                                    </Box>
                                )}
                                {msg.role === 'slot' && (
                                    <SlotMachine
                                        spinning={msg.spinning}
                                        suggestions={msg.suggestions}
                                        mealLibrary={mealLibrary}
                                        onSelect={onSelect}
                                        onClose={onClose}
                                    />
                                )}
                            </Box>
                        ))}
                        {loading && messages.length > 0 && !hasActiveSlot && (
                            <HStack spacing={2} color="gray.400">
                                <Spinner size="xs" color="purple.400" />
                                <Text fontSize="sm">Thinking…</Text>
                            </HStack>
                        )}
                        <div ref={bottomRef} />
                    </VStack>

                    <HStack mb={2}>
                        <Input
                            ref={inputRef}
                            placeholder={'Refine… e.g. "make it vegetarian", "something lighter"'}
                            size="sm"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            isDisabled={loading}
                        />
                        <Button size="sm" colorScheme="purple" onClick={send} isDisabled={!input.trim() || loading} flexShrink={0}>
                            Send
                        </Button>
                    </HStack>
                    <Button size="sm" variant="outline" colorScheme="purple" onClick={spinWheel} isDisabled={loading} w="full">
                        🎰 Surprise me!
                    </Button>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

export default AiChatModal;
