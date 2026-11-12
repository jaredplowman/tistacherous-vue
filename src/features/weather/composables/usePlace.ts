import { ref, watch } from 'vue'
import type { Place } from '../types'

const PLACE_KEY = 'place'
const DEFAULT_PLACE: Place = { name: 'Salmon Arm, BC', lat: 50.7001, lon: -119.2723 }

function loadPlace(): Place {
  try {
    return JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null') ?? DEFAULT_PLACE
  } catch {
    return DEFAULT_PLACE
  }
}

// One shared location for the weather page and the Today page's weather chip.
const place = ref<Place>(loadPlace())
watch(place, (p) => localStorage.setItem(PLACE_KEY, JSON.stringify(p)))

export const usePlace = () => place
