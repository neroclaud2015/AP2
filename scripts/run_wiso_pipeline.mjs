import {spawnSync} from 'node:child_process';
/** A production-registry change also refreshes derived WiSo data before bundling. */
const candidates=process.env.WISO_PYTHON?[process.env.WISO_PYTHON]:['python3','python'];
const python=candidates.find(p=>spawnSync(p,['--version'],{windowsHide:true,stdio:'ignore'}).status===0);
if(!python)throw Error('Python is required for WiSo derivation. Install requirements.txt and set WISO_PYTHON to the interpreter path.');
const run=spawnSync(python,['scripts/wiso_pipeline.py'],{stdio:'inherit',windowsHide:true,env:process.env});
if(run.error)throw run.error;
if(run.status!==0)process.exit(run.status??1);
