/** Start independent uploads together, but drain every branch before teardown. */
export async function completeWorldPreparation(abort,branches){
 const pending=branches.map(branch=>Promise.resolve().then(()=>{
  abort.signal.throwIfAborted();
  return branch();
 }).catch(error=>{abort.abort(error);throw error;}));
 await Promise.allSettled(pending);
 // The shared controller retains the first failure (or external cancellation),
 // rather than a sibling's later AbortError. No branch can still upload now.
 abort.signal.throwIfAborted();
}
