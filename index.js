let mongo = require('mongodb'),
	// server = requite('http-server'),
	MongoClient = mongo.MongoClient,
	url = "mongodb://localhost:27017/mydb",
	db = null,
	store = {},
	http = require('http'),
	hostname = '127.0.0.1',
	port = 3000,
	server = null;


function database(cb) {
	return MongoClient.connect(url, function(err, _db) {
	  if (err) throw err;
	  cb && cb(_db)
	  return;
	});
}

function webserver() {
	return http.createServer((req, res) => {
			let path = req.url.split('/'),
					operation = path[1],
					collection = path[2],
					query = path[3],
					writeData = path[4],
					assemble = (qs) =>{
						let assembled = {},
								properties = decodeURI(qs).split(',');
						if(!qs || properties.length < 1) {
							return null;
						}
						for(let i = 0; i < properties.length; i++){
							if(properties[i].length > 0 && properties[i].split('>').length > 1){
								assembled[properties[i].split('>')[0].trim()] = properties[i].split('>')[1];
								continue;
							}
						}
						return assembled;
					},
					assembledQuery = assemble(query),
					assembledWriteData = assemble(writeData),
					handle = () => {

						assembledQuery = (typeof assembledQuery == 'string' || assembledQuery instanceof String) 
							&& JSON.parse(assembledQuery) 
							|| assembledQuery;
						assembledWriteData = (typeof assembledWriteData == 'string' || assembledWriteData instanceof String) 
							&& JSON.parse(assembledWriteData) 
							|| assembledWriteData;
							
						switch(operation) {
							case 'create':
								if(!assembledQuery) {
									db.createCollection(collection, (err, results) => {
										if(err){
											res.statusCode = 401;
											res.end(JSON.stringify({
												status: 'error',
												result: 'Creating collection threw error'
											}));
										}
										res.statusCode = 200;
										res.end(JSON.stringify({
											status: 'success',
											result: 'Collection '+collection+' created'
										}));
									});
									break;
								}
								db.collection(collection).insertOne(assembledQuery, (err, result) => {
									res.statusCode = 200;
									res.end(JSON.stringify({
										status: 'success',
										result: result
									}));
								});
								break;
							case 'read':
								// let _query = 
								db.collection(collection).find(assembledQuery).toArray((err, result) => {
									if(result){
										res.statusCode = 200;
										res.end(JSON.stringify({
											status: 'success',
											result: result
										}));
									}
								});
								break;
							case 'delete':
								if(!assembledQuery){
									res.statusCode = 401;
									res.end(JSON.stringify({
										status:'error',
										result: 'Deletion of an entire collection is currently locked'
									}))
								}
								db.collection(collection).deleteOne(assembledQuery, (err, result) => {
									if(err) {
										res.statusCode = 401;
										res.end(JSON.stringify({
											status: 'error',
											result: 'Deletion of '+query+' in collection '+collection+' returned an error'
										}))
									}
									res.statusCode = 200;
									res.end(JSON.stringify({
										status: 'success',
										result: 'Deletion of '+query+' in collection '+collection+' success'
									}));
								})
								break;
							case 'update':
								let update = (mergedWriteData) => {
									console.log('updating merged write data', assembledQuery, mergedWriteData)
									db.collection(collection).updateOne(assembledQuery, mergedWriteData, (err, result) => {
										if(err) {
											res.statusCode = 401;
											res.end(JSON.stringify({
												status: 'error',
												result: 'Could not update '+query+' in collection '+collection
											}))
										}
										res.statusCode = 200;
										res.end(JSON.stringify({
											status: 'success',
											result: 'Updated '+query+' in collection '+collection
										}))
									});
								};
								db.collection(collection).findOne(assembledQuery, (err, result) => {
									if(err) {
										res.statusCode = 401;
										res.end(JSON.stringify({
											status:'error',
											result: 'Could not find record '+query+' to update in collection '+collection
										}));
									}
									update(Object.assign({}, result, assembledWriteData));
								});
								break;
						case 'upload':
							let blob = assembledWriteData && assembledWriteData['base64'] || null,
									filename = assembledWriteData && assembledWriteData['filename'] || null,
									fsDirectory = '/var/datastore/uploads/'+filename;
									
									if(!blob || !filename) {
										res.statusCode = 401;
										res.end(JSON.stringify({
											status: 'error',
											result: 'Need to send base64 property and filename property'
										}));
										return;
									}


									fs.readFile(fsDirectory, (err, result) => {
										if(!err){
											// handle existing file;
											filename = filename+Math.random(0, 999999);
											fsDirectory = '/var/datastore/uploads/'+filename;
										}
									})

									fs.writeFile((fsDirectory), new Buffer(blob, "base64"), (err, result) => {
										// console.log(err, result);
									});

									db.collection(collection).updateOne(assembledQuery, {[filename]: fsDirectory}, (err, result) => {
										// console.log(err, )
									})

							break;
							};
					}

			res.setHeader('Content-Type', 'application/json');
			res.setHeader("Access-Control-Allow-Origin", "*");

			if (req.method == 'POST') {
        req.on('data', (data) => {
        	if(!query) {
        		assembledQuery = assembledQuery || '';
        		assembledQuery += data;
        	} else {
        		assembledWriteData = '';
            assembledWriteData += data;
        	}
        });
        req.on('end', () => {
          handle();
        });
        return;
			}
			handle();
			return;
	});
}

function init() {
	database((_db)=>{
		db = _db;
		server = webserver();
		server.listen(port, hostname, () => {});
	});
}

init();
