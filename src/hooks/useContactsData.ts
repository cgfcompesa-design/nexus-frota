import { useQuery } from "@tanstack/react-query";
import { fetchContactsData } from "../services/fleetService";
import { useCallback } from "react";

export function useContactsData() {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: fetchContactsData,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const getEmailsByGerencia = useCallback((gerencia: string) => {
    if (!gerencia) return [];
    const contact = (contacts as any[]).find(
      c => c.gerencia === gerencia.toUpperCase().trim()
    );
    if (!contact || !contact.emails) return [];
    return contact.emails.split(";").map((e: string) => e.trim()).filter(Boolean);
  }, [contacts]);

  return { getEmailsByGerencia, contactsData: contacts, isLoading };
}
