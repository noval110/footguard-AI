import { useContext } from 'react'
import { CareContext } from './context'

export function useCare() { const care = useContext(CareContext); if (!care) throw new Error('CareProvider required'); return care }
