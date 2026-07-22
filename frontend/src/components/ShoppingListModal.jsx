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

    const printList = () => {
        if (!data) return;
        const rows = [];
        for (const cat of data.categories) {
            rows.push(`<h3>${cat.name}</h3>`);
            for (const item of cat.items)
                rows.push(`<label class="item"><input type="checkbox"> ${item.ingredient} <span class="recipe">(${item.recipe})</span></label>`);
        }
        if (data.mealsWithoutIngredients?.length > 0) {
            rows.push('<h3>No Ingredients</h3>');
            for (const name of data.mealsWithoutIngredients)
                rows.push(`<p class="note-item"><em>${name} — recipe has no ingredients yet</em></p>`);
        }
        if (data.mealsWithoutRecipe?.length > 0) {
            rows.push('<h3>No Recipe</h3>');
            for (const name of data.mealsWithoutRecipe)
                rows.push(`<p class="note-item"><em>${name} — no recipe linked</em></p>`);
        }
        if (data.guessedMeals?.length > 0)
            rows.push(`<p class="note">* Quantities estimated from meal name: ${data.guessedMeals.join(', ')}</p>`);

        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>Shopping List</title><style>
            body { font-family: sans-serif; font-size: 14px; margin: 24px; }
            h3 { margin: 16px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
            label.item { display: block; margin: 4px 0; cursor: default; }
            label.item input { margin-right: 6px; }
            .recipe { color: #999; font-size: 12px; }
            .note-item { margin: 3px 0 3px 20px; font-size: 13px; color: #666; }
            .note { font-size: 12px; color: #666; margin-top: 16px; }
        </style></head><body>${rows.join('')}</body></html>`);
        win.document.close();
        win.print();
    };

    const copyToClipboard = () => {
        if (!data) return;
        const lines = [];
        for (const cat of data.categories) {
            lines.push(`[${cat.name}]`);
            for (const item of cat.items) {
                lines.push(`  ${item.ingredient} (${item.recipe})`);
            }
            lines.push('');
        }
        if (data.mealsWithoutIngredients?.length > 0) {
            lines.push('[No Ingredients]');
            for (const name of data.mealsWithoutIngredients) lines.push(`  ${name}`);
            lines.push('');
        }
        if (data.mealsWithoutRecipe?.length > 0) {
            lines.push('[No Recipe]');
            for (const name of data.mealsWithoutRecipe) lines.push(`  ${name}`);
            lines.push('');
        }
        if (data.guessedMeals?.length > 0) {
            lines.push(`* Quantities estimated from meal name: ${data.guessedMeals.join(', ')}`);
        }
        navigator.clipboard.writeText(lines.join('\n'));
    };

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
                                                    alignItems="center"
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
                    {data && totalCount > 0 && (
                        <>
                            <Button size="sm" variant="outline" mr={2} onClick={printList}>
                                Print
                            </Button>
                            <Button size="sm" variant="outline" mr={2} onClick={copyToClipboard}>
                                Copy
                            </Button>
                        </>
                    )}
                    <Button size="sm" onClick={handleClose}>Done</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
