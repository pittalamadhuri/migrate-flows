const {Pool,Client} = require('pg');
const Query=require('pg').Query;
var query2=null;
var newflowid,stepcount,oldflow,oldflowid,currstep;
var newstepids=[];
var oldstepids=[];
const src_client = new Client({
  user: "eeouujjptfppof",
  password: "1b20807edd21309e06a646411394985f9e70c732161a70605ac49162490c3eb2",
  database: "d4kgesh2s13rk",
  port: 5432,
  host: "ec2-54-197-253-122.compute-1.amazonaws.com",
  ssl: true
});
const tar_client=new Client({
  user: "daylhuyuptrnrn",
  password: "bc3e47f3cf46a8be7082d61baa199a9332e0eb373eadd6bc79f67710f09fcbc7",
  database: "d2j624c7nmnp2",
  port: 5432,
  host: "ec2-54-243-239-66.compute-1.amazonaws.com",
  ssl: true
});
//Target client process
/*tar_client.connect((err)=>{
  if (err) {
    console.error('Target client connection error', err.stack)
  } else {
    console.log('connected to  target client');
    const query1=new Query("insert into flows");
    var result=src_client.query(query1);
query1.on('row', (row) => {
  console.log('row!', row.flow_id) // { name: 'brianc' }
})
query1.on('end', () => {
  console.log('query done')
})
query1.on('error', (err) => {
  console.error(err.stack)
})

  }

});*/



//Source client process starts
src_client.connect((err)=>{
  if (err) {
    console.error('Source client connection error', err.stack)
  } else {
    console.log('connected to source client');
    const query1=new Query("select id,applicationid from flows where id=(select flow_id from flow_texts where name='Configure Performance KPIs')");
    oldflow=src_client.query(query1);
    query1.on('row', (row) => {
      oldflowid=row.id;
      console.log('row!', row.id,row.applicationid);
      tar_client.connect();//connecting to target client
      //Inserting the flow instance to flows table
      tar_client.query("Insert into flows(applicationid) values("+row.applicationid+")",function(err,result){
        if(err)
        console.log("error in inserting flow");
        else
        {
          //Getting the flow id that is inserted in the target DB
          tar_client.query("select max(id) as id from flows",function(err,result){
            if(err)
            console.log("error in inserting flow");
            else{
            newflowid=result.rows[0].id;
            console.log(newflowid);//printing the new flow id just to be sure
            //process to insert the flow_text data which has the names of the flow
            //Getting the data from the source db
            src_client.query('select locale_id,name,description from flow_texts where flow_id= $1::integer',[oldflowid],(err,result)=>{
              if(err)
              console.log("error in fetching flow names from flow_texts "+err);
              else{
                //insert the flow texts into the target db
                for(var k=0;k<result.rows.length;k++)
                {
                  tar_client.query('insert into flow_texts(flow_id,locale_id,name,description) values($1::integer,$2::integer,$3::text,$4::text)',[newflowid,result.rows[k].locale_id,result.rows[k].name,result.rows[k].description],(err,result)=>{
                    if(err)
                    console.log("error in inserting flow_texts "+err);
                    else{
                      console.log('successfully inserted flow_texts content');
                    }
                });
            }}
          });
            //Getting flow step information from the source
            src_client.query("select id,index, options, admin_metadata from flow_steps where flow_id="+row.id+" and is_deleted=false order by index",function(err,result){
              if(err)console.log('Error while fetching data from source db');
              else{
                //console.log("metadata is ",result.rows[3].admin_metadata);
                //console.log("options is ",result.rows[3].options);
                stepcount=result.rows.length;//counting the number of steps in the flow(getting this from the resultset of above query)
                for(var i=0;i<result.rows.length;i++){
                  oldstepids.push(result.rows[i].id)
                  //inserting the resultset data into the target DB
                 tar_client.query('insert into flow_steps(flow_id,index,options,admin_metadata) values($1::integer,$2::integer,$3::json,$4::json)',[newflowid,result.rows[i].index,result.rows[i].options,result.rows[i].admin_metadata],(err,result)=>{
                   if(err)console.log('error while inserting row' +i+ 'error is '+err);
                   else
                   console.log('success in inserting rows');
                 });       
                }
                console.log('old step ids are '+oldstepids);
                //This next query is to get the step ids in the target db that are resulted by running the above insertions
                tar_client.query('select id from flow_steps order by id desc limit $1::integer',[stepcount],(err,result)=>{
                  if(err)console.log('error while getting inserted step id' +i+ ' and error is '+err);
                  else{
                  for(var j=0;j<stepcount;j++){
                    console.log('Row ids are '+result.rows[j].id);
                    newstepids.unshift(result.rows[j].id);
                    }
                    console.log(newstepids);
                    console.log('old step id first row is '+oldstepids[0]);
                    function delay(){
                      return new Promise(resolve=>  setTimeout(resolve,1000));
                    }
                    async function delayedLog(l){
                      await delay();
                      console.log(l);
                    }
                    //Process for getting step texts in diff languages
                   async function inser(){
                     for(var l=0;l<oldstepids.length;l++)
                   //for(var l=0;l<1;l++)
                    {
                      await delayedLog(l);
                      currstep=oldstepids[l];
                      currinstep=newstepids[l];
                      console.log('current insert step is '+currinstep);
                      //fetch flow_step_texts data from source db 
                     src_client.query("select * from flow_step_texts where flow_step_id=$1::integer and is_deleted=false",[currstep],function(err,result){
                        if(err)console.log('Error while fetching flow_step_texts data from source db '+err);
                        else{
                          console.log('fetched flow_step_texts data from source for step id '+currinstep);
                         for(var m=0;m<result.rows.length;m++){
                            //console.log(result.rows[m]);
                         tar_client.query('insert into flow_step_texts(flow_step_id,locale_id,title,content,comments) values($1::integer,$2::integer,$3::varchar,$4::text,$5::text)',[currinstep,result.rows[m].locale_id,result.rows[m].title,result.rows[m].content,result.rows[m].comments],(err,result1)=>{
                            if(err)console.log('error while inserting flow_step_texts for step id' +currinstep+ ' and error is '+err);
                            else{
                              console.log('success');
                            }
                          });
                        }//end for loop
                         }
                    });
                    // trial comments
                  }//end for loop
                }
                inser();
                  }
                  
                });
              
              }
               // console.log('index: %d and options: %j', result.rows[3].index, result.rows[3].options);
             });
            }
          });
        
        }
      });
      
      
      
     
    /*var oldflowsteps=src_client.query(query2);
    query2.on('row', (row) => {
      console.log('row!', row);
    })*/
    //console.log('name: %d and age: %s', query2.rows[3].index, query2.rows[3].options);
    })
/*    
query2.on('row', (row) => {
  console.log('row!', row.flow_id);
})
query2.on('end', () => {
  console.log('query done')
})
query2.on('error', (err) => {
  console.error(err.stack)
})*/

  }

});


//tar_client.connect();