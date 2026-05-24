
import { useState } from 'react';
import {
    Button,
    Input,
    SimpleGrid,
    FormControl,
    FormLabel,
    Select,
    useToast,
    Box,
    Heading,
    Stack
} from '@chakra-ui/react';

function MenuForm({ onAdd }) {
    const [form, setForm] = useState({
        mealDate: "",
        dayOfWeek: "",
        mealName: "",
        weather: "",
        highTempF: "",
        lowTempF: "",
        recipeLink: "",
        notes: ""
    });

    const toast = useToast();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleGetWeather = async () => {
        if (!form.mealDate) {
            toast({
                title: "Date required.",
                description: "Please choose a date before fetching the weather.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        try {
            const response = await fetch(`/api/weather?date=${form.mealDate}`);
            const data = await response.json();

            setForm({
                ...form,
                weather: data.condition,
                highTempF: data.high,
                lowTempF: data.low,
            });
        } catch (err) {
            console.error("Error fetching weather:", err);
            toast({
                title: "Weather fetch failed.",
                description: "Could not retrieve weather information.",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch("/api/menus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        })
            .then((res) => res.json())
            .then((newEntry) => {
                onAdd(newEntry);
                setForm({
                    mealDate: "",
                    dayOfWeek: "",
                    mealName: "",
                    weather: "",
                    highTempF: "",
                    lowTempF: "",
                    recipeLink: "",
                    notes: ""
                });
            })
            .catch((err) => console.error("Error saving entry:", err));
    };

    return (
        <form onSubmit={handleSubmit}>
            <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={4} mb={6}>
                <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input type="date" name="mealDate" value={form.mealDate} onChange={handleChange} required />
                </FormControl>
                <FormControl>
                    <FormLabel>Day</FormLabel>
                    <Select name="dayOfWeek" value={form.dayOfWeek} onChange={handleChange} required>
                        <option value="">Select Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                    </Select>
                </FormControl>
                <FormControl>
                    <FormLabel>Meal Name</FormLabel>
                    <Input name="mealName" value={form.mealName} onChange={handleChange} required />
                </FormControl>
                <FormControl>
                    <FormLabel>Recipe Link</FormLabel>
                    <Input name="recipeLink" value={form.recipeLink} onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Notes</FormLabel>
                    <Input name="notes" value={form.notes} onChange={handleChange} />
                </FormControl>
            </SimpleGrid>

            <Box borderWidth="1px" borderRadius="md" p={4} mb={6}>
                <Heading size="sm" mb={4}>Weather Info</Heading>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                    <FormControl>
                        <FormLabel>Weather</FormLabel>
                        <Input name="weather" value={form.weather} onChange={handleChange} />
                    </FormControl>
                    <FormControl>
                        <FormLabel>High Temp (°F)</FormLabel>
                        <Input type="number" name="highTempF" value={form.highTempF} onChange={handleChange} />
                    </FormControl>
                    <FormControl>
                        <FormLabel>Low Temp (°F)</FormLabel>
                        <Input type="number" name="lowTempF" value={form.lowTempF} onChange={handleChange} />
                    </FormControl>
                </SimpleGrid>
                <Stack mt={4} direction="row">
                    <Button onClick={handleGetWeather} isDisabled={!form.mealDate} colorScheme="blue">
                        Get Weather
                    </Button>
                </Stack>
            </Box>

            <Button type="submit" colorScheme="green">Add Menu</Button>
        </form>
    );
}

export default MenuForm;
