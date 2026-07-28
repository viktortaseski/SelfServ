export function formatTableLabel(table) {
    const name = table?.name || `Table ${table?.id ?? ""}`;
    const match = name.match(/(\d+)/);
    if (match) {
        return `TABLE ${match[1].padStart(2, "0")}`;
    }
    return name.toUpperCase();
}
