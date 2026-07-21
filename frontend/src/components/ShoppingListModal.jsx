import { useEffect, useRef, useState } from 'react';
import {
    Badge, Box, Button, Checkbox, Divider, HStack, Modal, ModalBody,
    ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
    Spinner, Text, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

export default function ShoppingListModal({ isOpen, onClose, weekStart, toDateStr }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [checked, setChecked] = useState({});
    const fetchedFor = useRef(null);

    useEffect(() => {
        if (!isOpen || !weekStart) return;
        const startStr = toDateStr(weekStart);
        if (fetchedFor.current === startStr) return;
        fetchedFor.current = startStr;
        setLoading(true);
        setData(null);
        setChecked({});
        authFetch(`/api/shopping-list?start=${startStr}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(err => { console.error(err); setLoading(false); });
    }, [isOpen, weekStart, toDateStr]);

    // Reset fetch cache when week changes so next open re-fetches
    useEffect(() => {
        fetchedFor.current = null;
    }, [weekStart]);

    const handleClose = () => {
        setChecked({});
        onClose();
    };

    const toggleItem = (key) => {
        setChecked(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const checkedCount = Object.values(checked).filter(Boolean).length;
    const totalCount = data?.categories?.reduce((sum, cat) => sum + cat.items.length, 0) ?? 0;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="md" scrollBehavior="inside">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md" pb={1}>
                    Shopping List
                    {!loading && data && totalCount > 0 && (
                        <Text as="span" fontSize="xs" fontWeight="normal" color="gray.500" ml={2}>
                            {checkedCount}/{totalCount} checked
                        </Text>
                    )}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody pt={2} pb={4}>
                    {loading && (
                        <HStack justify="center" py={8}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="gray.500">Building shopping list…</Text>
                        </HStack>
                    )}
                    {!loading && data && data.categories.length === 0 && (
                        <Text fontSize="sm" color="gray.500" py={4} textAlign="center">
                            No meals with recipes this week. Add recipes to your meals to generate a shopping list.
                        </Text>
                    )}
                    {!loading && data && data.categories.length > 0 && (
                        <VStack align="stretch" spacing={4}>
                            {data.categories.map((cat) => (
                                <Box key={cat.name}>
                                    <HStack mb={1}>
                                        <Badge colorScheme="green" fontSize="10px">{cat.name}</Badge>
                                    </HStack>
                                    <VStack align="stretch" spacing={1} pl={1}>
                                        {cat.items.map((item, idx) => {
                                            const key = `${cat.name}::${idx}::${item.ingredient}`;
                                            const done = !!checked[key];
                                            return (
                                                <Checkbox
                                                    key={key}
                                                    isChecked={done}
                                                    onChange={() => toggleItem(key)}
                                                    size="sm"
                                                    alignItems="flex-start"
                                                >
                                                    <Text
                                                        as="span"
                                                        fontSize="sm"
                                                        textDecoration={done ? 'line-through' : 'none'}
                                                        color={done ? 'gray.400' : 'inherit'}
                                                    >
                                                        {item.ingredient}
                                                    </Text>
                                                    <Text as="span" fontSize="xs" color="gray.400" ml={1}>
                                                        ({item.recipe})
                                                    </Text>
                                                </Checkbox>
                                            );
                                        })}
                                    </VStack>
                                    <Divider mt={3} />
                                </Box>
                            ))}
                            {data.guessedMeals?.length > 0 && (
                                <Box bg="blue.50" borderRadius="md" p={2} fontSize="xs" color="blue.700">
                                    * Quantities unknown — ingredients estimated from meal name:{' '}
                                    {data.guessedMeals.join(', ')}
                                </Box>
                            )}
                            {data.mealsWithoutIngredients?.length > 0 && (
                                <Box>
                                    <Badge colorScheme="orange" fontSize="10px" mb={1}>No Ingredients</Badge>
                                    <VStack align="stretch" spacing={1} pl={1}>
                                        {data.mealsWithoutIngredients.map((name) => (
                                            <Text key={name} fontSize="sm" color="gray.500" fontStyle="italic">
                                                {name} — recipe has no ingredients yet
                                            </Text>
                                        ))}
                                    </VStack>
                                </Box>
                            )}
                            {data.mealsWithoutRecipe?.length > 0 && (
                                <Box>
                                    <Badge colorScheme="gray" fontSize="10px" mb={1}>No Recipe</Badge>
                                    <VStack align="stretch" spacing={1} pl={1}>
                                        {data.mealsWithoutRecipe.map((name) => (
                                            <Text key={name} fontSize="sm" color="gray.500" fontStyle="italic">
                                                {name} — no recipe linked
                                            </Text>
                                        ))}
                                    </VStack>
                                </Box>
                            )}
                        </VStack>
                    )}
                </ModalBody>
                <ModalFooter pt={2}>
                    {checkedCount > 0 && (
                        <Button size="sm" variant="ghost" colorScheme="gray" mr="auto"
                            onClick={() => setChecked({})}>
                            Uncheck all
                        </Button>
                    )}
                    <Button size="sm" onClick={handleClose}>Done</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
