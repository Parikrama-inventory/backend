const constants = require('../config/constants')
const validate = require('../validation/validation')
const logger = require('../middleware/logger');
const config = require('config');
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const cors = require('cors');
const db = admin.firestore();

/**
 * @description Route to retireve all products from firestore
 * @returns Json object containing all products
 */
router.get("/", async (request, response, next) => {
    logger.info("Retrieving all products from firestore");
    const products = {
        "products": []
    }
    let productCollection = db.collection(constants.PRODUCT);
    let snapshot = await productCollection.get()
    snapshot.forEach(product => {
        var productInfo = {}
        var productData = product.data()
        productInfo[constants.PRODUCT] = product.id,
        productInfo[constants.CATEGORY] = productData.category,
        productInfo[constants.UNIT] = productData.unit,
        productInfo[constants.IS_ACTIVE] = productData.isActive,
        productInfo[constants.CREATED_DATE] = productData.createdDate.toDate(),
        productInfo[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productInfo);
    })
    products[constants.TOTAL_PRODUCTS] = snapshot.size;
    logger.debug('Returning product list to client.');
    response.status(200).send(products);
});

/**
 * @description Route to retrieve single product data from firestore
 * @returns Json object containing requested product
 * @throws 400 if the product does not exists in firestore
 */
router.get('/:product', async (request, response, next) => {
    var  requestedProduct = request.params.product.toLocaleLowerCase()
    logger.info(`Retrieving product ${requestedProduct} from firestore`)
    var productInfo = {}
    const doc = db.collection(constants.PRODUCT).doc(requestedProduct);
    const product = await doc.get()
    if (!product.exists) {
        const error = new Error(`Requested product ${requestedProduct} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var productData = product.data()
    productInfo[constants.PRODUCT] = product.id
    productInfo[constants.CATEGORY] = productData.category
    productInfo[constants.UNIT] = productData.unit
    productInfo[constants.IS_ACTIVE] = productData.isActive
    productInfo[constants.CREATED_DATE] = productData.createdDate.toDate()
    productInfo[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
    logger.debug(`Returning details for product ${requestedProduct} to client.`);
    response.status(200).send(productInfo);
});

/**
 * @description Route to retrieve products data from a given category
 * @returns Json object containing requested products
 */
router.get('/category/:category', async (request, response, next) => {
    var  requestedCategory = request.params.category.toLocaleLowerCase()
    logger.info(`Retrieving products of category ${requestedCategory} from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCT).where(constants.CATEGORY, '==', requestedCategory);
    const productSnapshot = await productRef.get()
    
    productSnapshot.forEach(product => {
        var productInfo = {}
        var productData = product.data()
        productInfo[constants.PRODUCT] = product.id
        productInfo[constants.CATEGORY] = productData.category
        productInfo[constants.UNIT] = productData.unit
        productInfo[constants.IS_ACTIVE] = productData.isActive
        productInfo[constants.CREATED_DATE] = productData.createdDate.toDate()
        productInfo[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productInfo);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning products of category ${requestedCategory} to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all active/inActive products
 * @returns Json object containing requested products
 */
router.get('/:active/active', async (request, response, next) => {
    var status = JSON.parse(request.params.active.toLocaleLowerCase());
    logger.info(`Retrieving all active/inActive products from firestore`)
    const products = {
        "products": []
    }

    const productRef = db.collection(constants.PRODUCT)
        .where(constants.IS_ACTIVE, '==', status);
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productInfo = {}
        var productData = product.data()
        productInfo[constants.PRODUCT] = product.id
        productInfo[constants.CATEGORY] = productData.category
        productInfo[constants.UNIT] = productData.unit
        productInfo[constants.IS_ACTIVE] = productData.isActive
        productInfo[constants.CREATED_DATE] = productData.createdDate.toDate()
        productInfo[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productInfo);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all active/inActive products data from a given category
 * @returns Json object containing requested products
 */
router.get('/:active/:category', async (request, response, next) => {
    var status = JSON.parse(request.params.active.toLocaleLowerCase());
    var category = request.params.category.toLocaleLowerCase();
    logger.info(`Retrieving all active/inActive products from a given category from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCT)
        .where(constants.IS_ACTIVE, '==', status)
        .where(constants.CATEGORY, '==', category)
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productInfo = {}
        var productData = product.data()
        productInfo[constants.PRODUCT] = product.id
        productInfo[constants.CATEGORY] = productData.category
        productInfo[constants.UNIT] = productData.unit
        productInfo[constants.IS_ACTIVE] = productData.isActive
        productInfo[constants.CREATED_DATE] = productData.createdDate.toDate()
        productInfo[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productInfo);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning products to client.`);
    response.status(200).send(products);
});


/**
 * @description Route to add products in Firestore
 * @returns Created product
 * @throws 400 if product already exists or if required params are missing
 */
router.post('/', async (request, response, next) => {
    logger.info(`Creating product in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.PRODUCT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category already exists, return 400
    var productName = request.body.product.toLocaleLowerCase()
    logger.info(`Creating product ${productName} in firestore....`);
    const doc = db.collection(constants.PRODUCT).doc(productName);
    const product = await doc.get()
    if (product.exists) {
        const err = new Error(`The product ${productName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = {}
    data[constants.UNIT] = request.body.unit.toLocaleLowerCase()
    data[constants.CATEGORY] = request.body.category.toLocaleLowerCase()
    data[constants.IS_ACTIVE] = true
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await db.collection(constants.PRODUCT).doc(productName).set(data)
    logger.debug(`${productName} document Created`)
    var result = {}
    result[constants.PRODUCT] = productName
    result[constants.CATEGORY] = data.category
    result[constants.UNIT] = data.unit
    response.status(200).send(result);    
});

/**
 * @description Route to update status of product
 * @returns  updated product
 * @throws 400 if product does not exist or has wrong params
 */
router.put('/status', async (request, response, next) => {
    logger.info(`Updating status for product in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.STATUS)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var productName = request.body.product.toLocaleLowerCase()
    logger.info(`Updating status of product ${productName} in firestore....`);
    const productRef = db.collection(constants.PRODUCT).doc(productName);
    const product = await productRef.get()
    if (!product.exists) {
        const err = new Error(`Requested product ${productName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.IS_ACTIVE] = request.body.isActive
    data[constants.LAST_UPDATED_DATE] = new Date()
    await productRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.PRODUCT] = productName
    data = JSON.parse(JSON.stringify( data, [constants.PRODUCT,constants.IS_ACTIVE]));
    logger.debug(`Updated status of product ${productName} to ${request.body.isActive}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to update category of product
 * @returns  updated product
 * @throws 400 if product does not exist or has wrong params
 */
router.put('/category', async (request, response, next) => {
    logger.info(`Updating category for product in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.CATEGORY)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var productName = request.body.product.toLocaleLowerCase()
    logger.info(`Updating category of product ${productName} in firestore....`);
    const productRef = db.collection(constants.PRODUCT).doc(productName);
    const product = await productRef.get()
    if (!product.exists) {
        const err = new Error(`Requested product ${productName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.CATEGORY] = request.body.category.toLocaleLowerCase()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await productRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.PRODUCT] = productName
    data = JSON.parse(JSON.stringify( data, [constants.PRODUCT,constants.CATEGORY]));
    logger.debug(`Updated category of product ${productName} to ${request.body.category}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to update unit of product
 * @returns  updated product
 * @throws 400 if product does not exist or has wrong params
 */
router.put('/unit', async (request, response, next) => {
    logger.info(`Updating unit for product in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.UNIT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var productName = request.body.product.toLocaleLowerCase()
    logger.info(`Updating unit of product ${productName} in firestore....`);
    const productRef = db.collection(constants.PRODUCT).doc(productName);
    const product = await productRef.get()
    if (!product.exists) {
        const err = new Error(`Requested product ${productName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.UNIT] = request.body.unit.toLocaleLowerCase()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await productRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.PRODUCT] = productName
    data = JSON.parse(JSON.stringify( data, [constants.PRODUCT,constants.UNIT]));
    logger.debug(`Updated unit of product ${productName} to ${request.body.unit}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to delete products
 * @returns  deleted product
 * @throws 400 if product does not exist
 */
router.delete('/:product', async(request, response, next) => {
    var  productName = request.params.product.toLocaleLowerCase()
    logger.info(`Deleting product ${productName} from firestore`)
    
    const productRef = db.collection(constants.PRODUCT).doc(productName);
    const product = await productRef.get()
    if (!product.exists) {
        const error = new Error(`Product ${productName} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    let data = {}
    const productData = product.data()
    data[constants.PRODUCT] = productName
    data[constants.CATEGORY] = productData.category
    data[constants.UNIT] = productData.unit
    
    await productRef.delete()
    logger.debug(`Deleted product ${productName}`)
    response
        .status(200)
        .send(data);
})

/**
  * Validates the request body.
  * @param {*} body request body
  * @param {*} type identifier to determine which request is to be validated
  *         product for create product
  *         description for updating description
  *         status for updating status
  *         status for updating unit
  */
 function validateParams(body, type) {
    let schema;
    switch(type) {
        case constants.PRODUCT:
            schema = joi.object({
                product: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                category: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                unit: joi.string()
                    .min(1)
                    .max(30)
                    .required()
            })
            break
        case  constants.STATUS:
            schema = joi.object({
                product: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                isActive: joi.bool()
                    .required()
            })
            break
        case constants.CATEGORY:
            schema = joi.object({
                product: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                category: joi.string()
                    .min(1)
                    .max(30)
                    .required()
            })
            break
        case constants.UNIT:
                schema = joi.object({
                    product: joi.string()
                        .min(1)
                        .max(30)
                        .required(),
                    unit: joi.string()
                        .min(1)
                        .max(30)
                        .required()
                })
    }
    return validate(schema, body)
}

module.exports = router;