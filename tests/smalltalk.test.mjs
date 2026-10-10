import assert from 'node:assert/strict'
import { smallTalkKind, quickReply } from '../src/lib/smalltalk.js'

const kinds = {
  'hi': 'greeting', 'Hello': 'greeting', 'Heyyy Hera!! 💜': 'greeting', 'hii': 'greeting', 'Good morning': 'greeting',
  'namaste ji': 'greeting', 'Thank you': 'thanks', 'thanks!!': 'thanks', 'tysm 💜': 'thanks', 'Thank you so much babe': 'thanks',
  'bye': 'bye', 'Good night Hera': 'bye',
  // These need the AI:
  'hi my cramps are bad': null, 'thanks, also my period started today': null, 'ok': null, 'yes': null,
  'hello I feel like ending it all': null, 'I want to die': null, '': null
}
for (const [msg, kind] of Object.entries(kinds)) assert.equal(smallTalkKind(msg), kind, msg)

const cycle = { mode: 'cycle', day: 9, phase: 'follicular' }
const r = quickReply('hi', { name: 'Mahi', tone: 'bestie' }, cycle, '2026-10-10')
assert.match(r, /Mahi/); assert.match(r, /day 9, in your follicular phase/)
assert.match(quickReply('hello', { name: 'Mahi', tone: 'facts' }, cycle, '2026-10-10'), /^Hi Mahi\./)
assert.match(quickReply('hi', { name: 'Mahi' }, { mode: 'pregnant', pregnancy: { week: 20 } }, '2026-10-10'), /week 20 of your pregnancy/)
assert.match(quickReply('hey', { name: 'Mahi', birth_date: '1999-10-10' }, cycle, '2026-10-10'), /Happy birthday Mahi/)
assert.ok(quickReply('thank you', {}, null, '2026-10-10'))
assert.equal(quickReply('what should I eat today?', {}, cycle, '2026-10-10'), null)
console.log('smalltalk tests passed')
