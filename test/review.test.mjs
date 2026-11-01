import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmBlockingFindings } from '../lib/review.mjs';
import { fixtureGuide,source } from './fixtures.mjs';

const review={completed:true,issues:['The registration instruction contradicts the source.'],findings:[{severity:'blocking',kind:'factual_error',message:'The registration instruction contradicts the source.',claimIds:['c2'],sourceIds:['s1']}]};
const ai=decisions=>({chat:async()=>({content:JSON.stringify({decisions})})});
test('a reviewer veto can be dismissed only with an actual saved passage',async()=>{
  const decision={id:'f1',decision:'dismissed',reason:'The guide agrees with the source.',sourceId:'s1',quote:'Register an OAuth application in the developer dashboard.'};
  const checked=await confirmBlockingFindings(ai([decision]),fixtureGuide(),{sources:[source]},review,new AbortController().signal);
  assert.deepEqual(checked.issues,[]);assert.equal(checked.findings[0].severity,'advisory');
  for(const changed of [{quote:'An invented source passage which is not present.'},{sourceId:'unknown'},{decision:'uncertain'}]){
    const blocked=await confirmBlockingFindings(ai([{...decision,...changed}]),fixtureGuide(),{sources:[source]},review,new AbortController().signal);
    assert.equal(blocked.issues.length,1);
  }
});

test('an incomplete correction recheck is not relabeled as a completed full review',async()=>{
  const checked=await confirmBlockingFindings(ai([{id:'f1',decision:'dismissed',reason:'The original issue was corrected.',sourceId:'s1',quote:source.content}]),fixtureGuide(),{sources:[source]},{...review,recheckCompleted:false},new AbortController().signal);
  assert.equal(checked.issues.length,0);assert.equal(checked.completed,false);
});
