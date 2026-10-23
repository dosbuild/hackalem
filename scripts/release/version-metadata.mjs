/** Standalone package identity; deployment revisions are optional environment input. */
export function releaseVersion(version,staticBuild=false,env=process.env){
 const commit=env.RAILWAY_GIT_COMMIT_SHA||env.GITHUB_SHA;
 if(commit&&!/^[a-f0-9]{40}$/.test(commit))throw Error('Deployment commit must be a complete lowercase Git SHA');
 return {application:'alem',version,model:'astana-education-1',delivery:staticBuild?'static':'connected',worlds:['astana','khanate'],...(commit?{commit}:{})};
}
