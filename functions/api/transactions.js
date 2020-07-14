const constants = require('../common/constants');
const logger = require('../middleware/logger');
const { isAdminOrSuperAdmin } = require('../middleware/auth');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all transactions under all branches
 * @returns Json object containing all transactions under all branches
 */
router.get("/", isAdminOrSuperAdmin, async (request, response, next) => {
    console.log("Retrieving all transactions under all branches");
    let branchCollectionRef = db.collection(constants.BRANCHES);
    let documents = []
    documents = await branchCollectionRef.listDocuments();
    const{user,product,fromDate,toDate} = request.query;    
    let alltransactions = []
    for(const doc of documents) {
        var branchtransactions = {}
        console.log(`fetching document of branch ${doc.id}`);
        const branchSnapshot = await doc.get()
        const branchData = branchSnapshot.data()
        let subCollectionDocRef = branchCollectionRef
                                    .doc(doc.id)
                                    .collection(constants.TRANSACTIONS)
                                    .orderBy(constants.DATE, 'desc');
        if(user){
            subCollectionDocRef = subCollectionDocRef.where(constants.USER,"==",user)
        }
        if(product){
            subCollectionDocRef = subCollectionDocRef.where(constants.PRODUCT,"==",product);
        }
        if(fromDate){
            subCollectionDocRef = subCollectionDocRef.where(constants.DATE,">=",new Date(fromDate));
        }
        if(toDate){
            toDate = new Date(toDate)
            // adding a day to the given query date as the new Date function returns 00:00:00 and we 
            // need to include the toDate for query .
            toDate.setDate(toDate.getDate()+1)
            console.log(toDate);
            subCollectionDocRef = subCollectionDocRef.where(constants.DATE,"<",new Date(toDate));
        }
        let snapshot = await subCollectionDocRef.get()
        branchtransactions[constants.BRANCH] = branchData[constants.NAME];
        branchtransactions[constants.TRANSACTIONS] = []
       
        snapshot.forEach(transaction => {
            var transactionData = transaction.data()
            transactionData[constants.ID] = transaction.id
            transactionData[constants.DATE] = transactionData[constants.DATE].toDate();
            branchtransactions[constants.TRANSACTIONS].push(transactionData)
        })
        alltransactions.push(branchtransactions);
    }
    //console.log(alltransactions)
    logger.debug('Returning all transactions for all branches.');
    response.status(200).send(alltransactions);
});
/**
 * @description Route to retireve all transactions under given branch for given user
 * @returns Json object containing all transactions under given branch for given user
 */
router.get("/:id", isAdminOrSuperAdmin, async (request, response, next) => {
    logger.info("Retrieving all transactions under given branch for given user");
    var branchId = request.params.id
    var{user,product,fromDate,toDate} = request.query;
    const pageSize = constants.PAGE_SIZE
    var nextPageToken = request.query.nextPageToken ? request.query.nextPageToken : null;
    var prevPageToken = request.query.prevPageToken ? request.query.prevPageToken : null;
    
    let transactionCollection = db.collection(constants.BRANCHES)
                                    .doc(branchId)
                                    .collection(constants.TRANSACTIONS)
                                    .orderBy(constants.DATE, 'desc')
    if(user){
        transactionCollection = transactionCollection.where(constants.USER,"==",user)
    }
    if(product){
        transactionCollection = transactionCollection.where(constants.PRODUCT,"==",product);
    }
    if(fromDate){
        transactionCollection = transactionCollection.where(constants.DATE,">=",new Date(fromDate));
    }
    if(toDate){
        toDate = new Date(toDate)
        // adding a day to the given query date as the new Date function returns 00:00:00 and we 
        // need to include the toDate for query .
        toDate.setDate(toDate.getDate()+1)
        console.log(toDate);
        transactionCollection = transactionCollection.where(constants.DATE,"<",toDate);
    }
    if(nextPageToken !== null && prevPageToken !== null) {
        response.status(400)
        .send("Invalid Query Parameters, Please send either nextPageToken or prevPageToken");

    }
    var transCollectionOrig = transactionCollection
    const res = {}
    //Case 1 : if both are null, then default to sending first time with defined pagesize
    if(nextPageToken === null && prevPageToken === null) {
            transactionCollection = transactionCollection
                .limit(pageSize)
    }
    //Case 2 : only nextPageToken is given, then start after the doc id + pagesize
    if(nextPageToken !== null ) {
        var lastVisibleDoc = await db.collection(constants.BRANCHES)
            .doc(branchId)
            .collection(constants.TRANSACTIONS)
            .doc(nextPageToken)
            .get()
        console.log (lastVisibleDoc.id);
        if(lastVisibleDoc){
            transactionCollection = transactionCollection
                .startAfter(lastVisibleDoc)
                .limit(pageSize)
            }
    }
    // Case 3 : Only prev page token is give, then end Before the given doc id with limit pagesize.
    if(prevPageToken !== null) {
    var prevVisibleDoc = await db.collection(constants.BRANCHES)
            .doc(branchId)
            .collection(constants.TRANSACTIONS)
            .doc(prevPageToken)
            .get()
        console.log (prevVisibleDoc.id);
        if(prevVisibleDoc){
            transactionCollection = transactionCollection
                .endBefore(prevVisibleDoc)
                .limitToLast(pageSize)
        }
    }
    let snapshot = await transactionCollection.get()
    //To identify if its end of pages ( no prev or no next)
    const hasPrevious =  await hasPreviousPage(transCollectionOrig,snapshot)
    const hasNext = await hasNextPage(transCollectionOrig,snapshot)

    //Final query retrieval
    const branchTransactions = []
    var size = snapshot.docs.length;
    console.log(`result size: ${size}`)
    for(var i=0;i<size;i++){
        transaction = snapshot.docs[i]
        var transactionData = transaction.data()
        transactionData[constants.ID] = transaction.id
        transactionData[constants.DATE] = transactionData[constants.DATE].toDate();
        branchTransactions.push(transactionData)
    }
    // Populating the response ( with page tokens)
    res[constants.TRANSACTIONS] = branchTransactions
    if(size >0){
        res[constants.NEXT_PAGE_TOKEN]= hasNext ? snapshot.docs[size-1].id : null;
        res[constants.PREV_PAGE_TOKEN]= hasPrevious ? snapshot.docs[0].id : null;
    }
    response.status(200).send(res);
});

async function hasPreviousPage (transactionCollection, snapshot){
    var initialtransaction = snapshot.docs[0]
    transactionCollection = transactionCollection
                            .endBefore(initialtransaction)
                            .limitToLast(constants.PAGE_SIZE)
    let prevPageSnapshot = await transactionCollection.get()
    hasPrevPage = (prevPageSnapshot.docs.length>0)
    return new Promise((resolve,reject) => {   
        resolve(hasPrevPage)
    });
}
async function hasNextPage (transactionCollection, snapshot){
    var size = snapshot.docs.length
    var lasttransaction = snapshot.docs[size-1]
    transactionCollection = transactionCollection
                            .startAfter(lasttransaction)
                            .limit(constants.PAGE_SIZE)
    let nextPageSnapshot = await transactionCollection.get()
    hasNxtPage = (nextPageSnapshot.docs.length>0)
    return new Promise((resolve,reject) => {   
        resolve(hasNxtPage)
    });
}

module.exports = router;