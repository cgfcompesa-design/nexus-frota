
export function deduplicateFuelTransactions(transactions: any[]) {
  // Logic to remove duplicates based on some ID or timestamp+placa
  const seen = new Set();
  return transactions.filter(t => {
    const key = `${t.PLACA || t.Placa}-${t["DATA TRANSACAO"]}-${t.LITROS}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
