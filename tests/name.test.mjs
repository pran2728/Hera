import assert from 'node:assert/strict'
import { extractName } from '../src/lib/name.js'
const cases = {
  'You can call me Pran': 'Pran',
  'you can call me pran': 'Pran',
  'Call me Pran please': 'Pran',
  'My name is Pranathi Josyula': 'Pranathi Josyula',
  "I'm Pran 💜": 'Pran',
  'Pran': 'Pran',
  'pranathi': 'Pranathi',
  'Hi! Just call me Pran.': 'Pran',
  "It's Pran, thanks": 'Pran',
  'Everyone calls me Pran': 'Pran',
  'Anjali Rao': 'Anjali Rao',
  'call me Pran and you are Hera': 'Pran',
  'Mary-Jane': 'Mary-Jane',
  'Kim Lee': 'Kim Lee',
  'Nadim Ahmed': 'Nadim Ahmed',
  'Simran': 'Simran',
  'Callie': 'Callie'
}
for (const [input, want] of Object.entries(cases)) assert.equal(extractName(input), want, input)
console.log('all name tests passed')
