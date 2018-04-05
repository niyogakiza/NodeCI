const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys = require('../config/keys');

//redis config
//const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;


mongoose.Query.prototype.cache = function(options = {}){
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');


    return this;// working as chainable functions call
};

mongoose.Query.prototype.exec = async function(){
  if(!this.useCache){
      return exec.apply(this, arguments);
  }
 // console.log('IAM ABOUT TO RUN A QUERY');
  // console.log(this.getQuery());
  // console.log(this.mongooseCollection.name);
  const key = JSON.stringify(Object.assign({}, this.getQuery(),{
      collection: this.mongooseCollection.name
  }));
  //console.log(key);

    // see if we have a value for 'key' in redis
    const cacheValue = await client.hget(this.hashKey, key);

    //if we do, return that
    if(cacheValue){
        const doc = JSON.parse(cacheValue);
        return Array.isArray(doc)
            ? doc.map(d => new this.model(d))
            : new this.model(doc);
    }

    //Otherwise, issue the query and store the result in redis
     const result = await exec.apply(this, arguments);
     //console.log(result);
    client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);
     return result;
};


//Delete data that is stored on particular key, in case of using user id will delete all user posted blogs.
module.exports = {
    clearHash(hashKey){
        client.del(JSON.stringify(hashKey));
    }
};