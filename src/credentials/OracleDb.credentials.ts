import {
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class OracleDb implements ICredentialType {
    name = 'oracleDb';
    displayName = 'BGS-Oracledb-connector';
    documentationUrl = 'oracleDb';
    properties: INodeProperties[] = [
        {
            displayName: 'Host',
            name: 'host',
            type: 'string',
            default: 'localhost',
            description: 'The Oracle database host',
        },
        {
            displayName: 'Port',
            name: 'port',
            type: 'number',
            default: 1521,
            description: 'The Oracle database port',
        },
        {
            displayName: 'Service Name',
            name: 'serviceName',
            type: 'string',
            default: '',
            description: 'The Oracle database service name (e.g., ORCL)',
        },
        {
            displayName: 'User',
            name: 'user',
            type: 'string',
            default: '',
            description: 'The Oracle database user',
        },
        {
            displayName: 'Password',
            name: 'password',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            description: 'The Oracle database password',
        },
        {
            displayName: 'Connection String (Optional)',
            name: 'connectionString',
            type: 'string',
            default: '',
            description: 'Optional: Full connection string (overrides host, port, and service name)',
            placeholder: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=ORCL)))',
        },
    ];
}