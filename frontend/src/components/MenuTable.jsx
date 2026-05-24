import {
  Link,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td
} from '@chakra-ui/react';

function MenuTable({ menus }) {
  return (
    <Table variant="striped" colorScheme="gray">
      <Thead>
        <Tr>
          <Th>Date</Th>
          <Th>Day</Th>
          <Th>Meal</Th>
          <Th>Weather</Th>
          <Th>High Temp (°F)</Th>
          <Th>Low Temp (°F)</Th>
          <Th>Recipe Link</Th>
          <Th>Notes</Th>
        </Tr>
      </Thead>
      <Tbody>
        {menus.map((entry) => (
          <Tr key={entry.id}>
            <Td>{entry.mealDate}</Td>
            <Td>{entry.dayOfWeek}</Td>
            <Td>{entry.mealName}</Td>
            <Td>{entry.weather}</Td>
            <Td>{entry.highTempF ?? "—"}</Td>
            <Td>{entry.lowTempF ?? "—"}</Td>
            <Td>
              {entry.recipeLink ? (
                <Link href={entry.recipeLink} color="blue.500" isExternal>Link</Link>
              ) : "—"}
            </Td>
            <Td>{entry.notes}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

export default MenuTable;
