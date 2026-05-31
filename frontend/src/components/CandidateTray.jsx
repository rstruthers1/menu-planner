import { useState } from 'react';
import { Box, Button, HStack, Input, Tag, TagCloseButton, TagLabel, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function DraggableChip({ name, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: name });
    return (
        <Tag
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                opacity: isDragging ? 0.4 : 1,
                cursor: 'grab',
                touchAction: 'none',
            }}
            size="md"
            colorScheme="purple"
            borderRadius="full"
            shadow={isDragging ? 'md' : 'none'}
            {...listeners}
            {...attributes}
        >
            <TagLabel>{name}</TagLabel>
            <TagCloseButton
                onPointerDown={e => e.stopPropagation()}
                onClick={() => onRemove(name)}
            />
        </Tag>
    );
}

function CandidateTray({ candidates, setCandidates, mealSuggestions }) {
    const [isOpen, setIsOpen] = useState(true);
    const [input, setInput] = useState('');

    const addCandidate = (name) => {
        const trimmed = name.trim();
        if (!trimmed || candidates.includes(trimmed)) return;
        setCandidates(prev => [...prev, trimmed]);
        setInput('');
    };

    return (
        <Box mb={4} borderWidth="1px" borderRadius="lg" borderColor="purple.200" overflow="hidden">
            <HStack
                px={4} py={2} bg="purple.50" justify="space-between"
                cursor="pointer" userSelect="none"
                onClick={() => setIsOpen(o => !o)}
            >
                <Text fontSize="sm" fontWeight="semibold" color="purple.700">
                    Candidate meals{candidates.length > 0 ? ` (${candidates.length})` : ''}
                </Text>
                <Text fontSize="xs" color="purple.400">{isOpen ? '▲' : '▼'}</Text>
            </HStack>

            {isOpen && (
                <Box p={4}>
                    <Text fontSize="xs" color="gray.400" mb={3}>
                        {candidates.length === 0
                            ? 'Add meals below, then drag them onto a day.'
                            : 'Drag a meal onto a day to plan it.'}
                    </Text>

                    {candidates.length > 0 && (
                        <Wrap spacing={2} mb={4} maxH="120px" overflowY="auto">
                            {candidates.map(name => (
                                <WrapItem key={name}>
                                    <DraggableChip
                                        name={name}
                                        onRemove={name => setCandidates(prev => prev.filter(c => c !== name))}
                                    />
                                </WrapItem>
                            ))}
                        </Wrap>
                    )}

                    <HStack>
                        <Input
                            list="candidate-meal-list"
                            placeholder="Search meal library…"
                            size="sm"
                            value={input}
                            onChange={e => {
                                const val = e.target.value;
                                setInput(val);
                                // Auto-add when a datalist option is selected
                                if (mealSuggestions.includes(val)) addCandidate(val);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCandidate(input); } }}
                        />
                        <datalist id="candidate-meal-list">
                            {mealSuggestions.filter(s => !candidates.includes(s)).map(s => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                        <Button
                            size="sm"
                            colorScheme="purple"
                            variant="outline"
                            onClick={() => addCandidate(input)}
                            isDisabled={!input.trim()}
                        >
                            Add
                        </Button>
                    </HStack>
                </Box>
            )}
        </Box>
    );
}

export default CandidateTray;
