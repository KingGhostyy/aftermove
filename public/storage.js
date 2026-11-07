export const SAVE_WARNING='Analysis is available in this tab, but could not be saved. Keep this tab open; reloading may lose the latest results.';

export async function persistWorkspace(writeSnapshot,username,games,cache,version){
  for(const game of games)cache.set(game.id,game);
  if(!writeSnapshot)return false;
  try{
    await writeSnapshot(username.toLowerCase(),{games,cache:[...cache.values()],version},username);
    return true;
  }catch{return false;}
}
