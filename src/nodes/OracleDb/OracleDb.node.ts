import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
    IDataObject,
    NodeConnectionType,
} from 'n8n-workflow';

import * as oracledb from 'oracledb';

// Helper function to convert n8n values to Oracle-compatible types
function convertToOracleType(value: any): string | number | Date | Buffer | null {
    if (value === null || value === undefined) {
        return null;
    } else if (typeof value === 'boolean') {
        return value ? 1 : 0;
    } else if (value instanceof Date) {
        return value;
    } else if (value instanceof Buffer) {
        return value;
    } else if (typeof value === 'object') {
        return JSON.stringify(value);
    } else if (typeof value === 'string' || typeof value === 'number') {
        return value;
    } else {
        return String(value);
    }
}

export class OracleDb implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'BGS-Oracledb-connector',
        name: 'oracleDb',
        icon: 'file:oracledb.svg',
        group: ['transform'],
        version: 1,
        description: 'Execute queries on Oracle Database',
        defaults: {
            name: 'Oracle Database',
        },
        inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
        credentials: [
            {
                name: 'oracleDb',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Execute Query',
                        value: 'executeQuery',
                        description: 'Execute a SQL query',
                    },
                    {
                        name: 'Execute Stored Procedure',
                        value: 'executeProcedure',
                        description: 'Execute a stored procedure',
                    },
                    {
                        name: 'Insert',
                        value: 'insert',
                        description: 'Insert rows into a table',
                    },
                    {
                        name: 'Update',
                        value: 'update',
                        description: 'Update rows in a table',
                    },
                    {
                        name: 'Delete',
                        value: 'delete',
                        description: 'Delete rows from a table',
                    },
                ],
                default: 'executeQuery',
            },
            {
                displayName: 'Query',
                name: 'query',
                type: 'string',
                typeOptions: {
                    rows: 5,
                },
                displayOptions: {
                    show: {
                        operation: ['executeQuery'],
                    },
                },
                default: '',
                placeholder: 'SELECT * FROM users WHERE id = :id',
                required: true,
                description: 'The SQL query to execute. Use :paramName for named parameters',
            },
            {
                displayName: 'Query Parameters',
                name: 'queryParams',
                type: 'json',
                displayOptions: {
                    show: {
                        operation: ['executeQuery'],
                    },
                },
                default: '{}',
                placeholder: '{"id": 1}',
                description: 'Parameters to bind to the query. Parameter names should match the :paramName in the query',
            },
            {
                displayName: 'Table',
                name: 'table',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['insert', 'update', 'delete'],
                    },
                },
                default: '',
                required: true,
                description: 'The name of the table',
            },
            {
                displayName: 'Columns',
                name: 'columns',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['insert'],
                    },
                },
                default: '',
                placeholder: 'id,name,email',
                description: 'Comma-separated list of columns to insert',
            },
            {
                displayName: 'Update Key',
                name: 'updateKey',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['update'],
                    },
                },
                default: 'id',
                description: 'The column to use for matching rows to update',
            },
            {
                displayName: 'Delete Key',
                name: 'deleteKey',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['delete'],
                    },
                },
                default: 'id',
                description: 'The column to use for matching rows to delete',
            },
            {
                displayName: 'Procedure Name',
                name: 'procedure',
                type: 'string',
                displayOptions: {
                    show: {
                        operation: ['executeProcedure'],
                    },
                },
                default: '',
                required: true,
                description: 'The name of the stored procedure',
            },
            {
                displayName: 'Procedure Parameters',
                name: 'procedureParams',
                type: 'json',
                displayOptions: {
                    show: {
                        operation: ['executeProcedure'],
                    },
                },
                default: '{}',
                description: 'Parameters for the stored procedure',
            },
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    {
                        displayName: 'Auto Commit',
                        name: 'autoCommit',
                        type: 'boolean',
                        default: true,
                        description: 'Whether to auto-commit transactions',
                    },
                    {
                        displayName: 'Fetch Size',
                        name: 'fetchSize',
                        type: 'number',
                        default: 100,
                        description: 'Number of rows to fetch at a time',
                    },
                    {
                        displayName: 'Max Rows',
                        name: 'maxRows',
                        type: 'number',
                        default: 0,
                        description: 'Maximum number of rows to return (0 = no limit)',
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const credentials = await this.getCredentials('oracleDb');
        const operation = this.getNodeParameter('operation', 0) as string;
        const options = this.getNodeParameter('options', 0, {}) as IDataObject;

        let connection: oracledb.Connection | undefined;

        try {
            // Build connection config
            const connectionConfig: oracledb.ConnectionAttributes = {
                user: credentials.user as string,
                password: credentials.password as string,
            };

            if (credentials.connectionString) {
                connectionConfig.connectString = credentials.connectionString as string;
            } else {
                connectionConfig.connectString = `${credentials.host}:${credentials.port}/${credentials.serviceName}`;
            }

            // Initialize Oracle client (required for some environments)
            try {
                oracledb.initOracleClient();
            } catch (err) {
                // Client might already be initialized or not required
                console.log('Oracle client initialization skipped:', err instanceof Error ? err.message : 'Unknown error');
            }

            // Get connection
            connection = await oracledb.getConnection(connectionConfig);

            const returnData: INodeExecutionData[] = [];

            for (let i = 0; i < items.length; i++) {
                try {
                    let result: any;

                    if (operation === 'executeQuery') {
                        const query = this.getNodeParameter('query', i) as string;
                        let queryParams = this.getNodeParameter('queryParams', i, {}) as IDataObject;
                        
                        // Parse queryParams if it's a string
                        if (typeof queryParams === 'string') {
                            try {
                                queryParams = JSON.parse(queryParams);
                            } catch (e) {
                                throw new Error('Invalid JSON in Query Parameters');
                            }
                        }

                        // Convert queryParams to the format Oracle expects
                        const binds: oracledb.BindParameters = {};
                        for (const [key, value] of Object.entries(queryParams)) {
                            binds[key] = convertToOracleType(value);
                        }
                        
                        const executeOptions: oracledb.ExecuteOptions = {
                            autoCommit: (options.autoCommit as boolean) ?? true,
                            fetchArraySize: (options.fetchSize as number) ?? 100,
                            maxRows: (options.maxRows as number) ?? 0,
                            outFormat: oracledb.OUT_FORMAT_OBJECT,
                        };

                        result = await connection.execute(query, binds, executeOptions);

                        if (result.rows && Array.isArray(result.rows)) {
                            for (const row of result.rows) {
                                returnData.push({ json: row as IDataObject });
                            }
                        } else {
                            returnData.push({
                                json: {
                                    success: true,
                                    rowsAffected: result.rowsAffected ?? 0,
                                },
                            });
                        }
                    } else if (operation === 'insert') {
                        const table = this.getNodeParameter('table', i) as string;
                        const columns = this.getNodeParameter('columns', i) as string;
                        const columnList = columns.split(',').map(c => c.trim());
                        
                        const binds: oracledb.BindParameters = {};
                        const values: any[] = [];
                        
                        columnList.forEach((col, idx) => {
                            const value = items[i].json[col];
                            const paramName = `val${idx + 1}`;
                            binds[paramName] = convertToOracleType(value);
                            values.push(`:${paramName}`);
                        });
                        
                        const insertQuery = `INSERT INTO ${table} (${columnList.join(',')}) VALUES (${values.join(',')})`;
                        
                        result = await connection.execute(
                            insertQuery,
                            binds,
                            { autoCommit: (options.autoCommit as boolean) ?? true }
                        );

                        returnData.push({
                            json: {
                                success: true,
                                rowsAffected: result.rowsAffected ?? 0,
                            },
                        });
                    } else if (operation === 'update') {
                        const table = this.getNodeParameter('table', i) as string;
                        const updateKey = this.getNodeParameter('updateKey', i) as string;
                        
                        const itemData = items[i].json;
                        const updateKeyValue = itemData[updateKey];
                        
                        const binds: oracledb.BindParameters = {};
                        const updates: string[] = [];
                        let paramIndex = 1;
                        
                        // Build SET clause
                        for (const [key, value] of Object.entries(itemData)) {
                            if (key !== updateKey) {
                                updates.push(`${key} = :val${paramIndex}`);
                                binds[`val${paramIndex}`] = convertToOracleType(value);
                                paramIndex++;
                            }
                        }
                        
                        // Add WHERE clause parameter
                        binds[`key${paramIndex}`] = convertToOracleType(updateKeyValue);
                        
                        const updateQuery = `UPDATE ${table} SET ${updates.join(', ')} WHERE ${updateKey} = :key${paramIndex}`;
                        
                        result = await connection.execute(
                            updateQuery,
                            binds,
                            { autoCommit: (options.autoCommit as boolean) ?? true }
                        );

                        returnData.push({
                            json: {
                                success: true,
                                rowsAffected: result.rowsAffected ?? 0,
                            },
                        });
                    } else if (operation === 'delete') {
                        const table = this.getNodeParameter('table', i) as string;
                        const deleteKey = this.getNodeParameter('deleteKey', i) as string;
                        const deleteKeyValue = items[i].json[deleteKey];
                        
                        const deleteQuery = `DELETE FROM ${table} WHERE ${deleteKey} = :deleteValue`;
                        
                        result = await connection.execute(
                            deleteQuery,
                            { deleteValue: convertToOracleType(deleteKeyValue) },
                            { autoCommit: (options.autoCommit as boolean) ?? true }
                        );

                        returnData.push({
                            json: {
                                success: true,
                                rowsAffected: result.rowsAffected ?? 0,
                            },
                        });
                    } else if (operation === 'executeProcedure') {
                        const procedure = this.getNodeParameter('procedure', i) as string;
                        let procedureParams = this.getNodeParameter('procedureParams', i, {}) as IDataObject;
                        
                        // Parse procedureParams if it's a string
                        if (typeof procedureParams === 'string') {
                            try {
                                procedureParams = JSON.parse(procedureParams);
                            } catch (e) {
                                throw new Error('Invalid JSON in Procedure Parameters');
                            }
                        }

                        const binds: oracledb.BindParameters = {};
                        const paramNames: string[] = [];
                        
                        for (const [key, value] of Object.entries(procedureParams)) {
                            binds[key] = convertToOracleType(value);
                            paramNames.push(`:${key}`);
                        }
                        
                        const plsql = `BEGIN ${procedure}(${paramNames.join(', ')}); END;`;
                        
                        result = await connection.execute(
                            plsql,
                            binds,
                            { autoCommit: (options.autoCommit as boolean) ?? true }
                        );

                        returnData.push({
                            json: {
                                success: true,
                                outBinds: result.outBinds || {},
                            },
                        });
                    }
                } catch (error) {
                    if (this.continueOnFail()) {
                        returnData.push({
                            json: {
                                error: error instanceof Error ? error.message : 'Unknown error occurred',
                            },
                        });
                        continue;
                    }
                    throw error;
                }
            }

            return [returnData];
        } catch (error) {
            if (error instanceof Error) {
                throw new NodeOperationError(this.getNode(), error.message);
            }
            throw new NodeOperationError(this.getNode(), 'An unknown error occurred');
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (error) {
                    console.error('Error closing connection:', error);
                }
            }
        }
    }
}