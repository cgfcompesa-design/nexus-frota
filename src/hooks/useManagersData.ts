import { useState, useEffect } from 'react';

export interface ManagerContact {
  gerencia: string;
  email: string;
}

const MANAGERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-IX8SNiQVbdaxqRZVaseGcFzoj8-Y4x-i39e8-Q46PHU1tGq0oPMCXGpdzcTT98uNheWTmPp7SjR0/pub?gid=503746336&single=true&output=csv';

export function useManagersData() {
  const [managers, setManagers] = useState<ManagerContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(MANAGERS_CSV_URL);
        const csvText = await response.text();
        
        const lines = csvText.split('\n');
        const data: ManagerContact[] = [];
        
        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Split by comma, handling potential quotes
          const parts = line.split(',').map(part => part.trim().replace(/^"|"$/g, ''));
          
          if (parts.length >= 2) {
            data.push({
              gerencia: parts[0],
              email: parts[1]
            });
          }
        }
        
        setManagers(data);
      } catch (error) {
        console.error('Error fetching managers data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  const getManagerEmail = (gerencia: string): string[] => {
    // Exact or partial match for Gerência
    const match = managers.find(m => 
      m.gerencia.toLowerCase() === gerencia.toLowerCase() || 
      gerencia.toLowerCase().includes(m.gerencia.toLowerCase())
    );
    
    if (match && match.email) {
      return match.email.split(/[;,\s]+/).filter(Boolean);
    }
    
    return [];
  };

  return { managers, getManagerEmail, loading };
}
