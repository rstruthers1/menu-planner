import { useEffect, useState } from 'react';
import { Box, Heading, VStack } from '@chakra-ui/react';
import MenuForm from './components/MenuForm';
import MenuTable from './components/MenuTable';

function App() {
    const [menus, setMenus] = useState([]);

    useEffect(() => {
        fetch('/api/menus')
            .then((res) => res.json())
            .then((data) => setMenus(data))
            .catch((err) => console.error('Error fetching menus:', err));
    }, []);

    const addMenuEntry = (entry) => {
        setMenus((prev) => [...prev, entry]);
    };

    return (
        <Box p={6}>
            <Heading as="h1" mb={6}>Weekly Menu Entries</Heading>
            <MenuForm onAdd={addMenuEntry} />
            <MenuTable menus={menus} />
        </Box>
    );
}

export default App;
