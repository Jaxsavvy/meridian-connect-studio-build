import { spawnSync } from 'node:child_process';

export const REPOSITORY = 'Jaxsavvy/meridian-connect-studio-build';
export const PROJECT_OWNER = 'Jaxsavvy';
export const PROJECT_NUMBER = 1;
export const ISSUE_NUMBER = 3;
export const ISSUE_URL = `https://github.com/${REPOSITORY}/issues/${ISSUE_NUMBER}`;

const TASK_QUERY = `
query BoardTask($owner: String!, $repo: String!, $issue: Int!, $project: Int!, $after: String) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    nameWithOwner
    issue(number: $issue) {
      id number url title state
      projectItems(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          project { id number title }
          fieldValues(first: 50) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name optionId
                field { ... on ProjectV2SingleSelectField { id name } }
              }
            }
          }
        }
      }
    }
  }
  user(login: $owner) {
    login
    projectV2(number: $project) {
      id number title closed
      fields(first: 50) {
        nodes { ... on ProjectV2SingleSelectField { id name options { id name } } }
      }
    }
  }
}`;

const UPDATE_QUERY = `
mutation BoardStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
    value: { singleSelectOptionId: $optionId }
  }) { projectV2Item { id } }
}`;

export class BoardError extends Error {
  constructor(category, message) {
    super(message);
    this.name = 'BoardError';
    this.category = category;
  }
}

export function createGhClient(run = runGraphql) {
  return {
    async read() {
      const matches = [];
      let cursor = null;
      let issue;
      let project;
      let actor;
      for (let page = 0; page < 20; page += 1) {
        const data = await run(TASK_QUERY, {
          owner: PROJECT_OWNER,
          repo: REPOSITORY.split('/')[1],
          issue: ISSUE_NUMBER,
          project: PROJECT_NUMBER,
          after: cursor,
        });
        actor = data.viewer?.login;
        issue = data.repository?.issue;
        project = data.user?.projectV2;
        if (data.repository?.nameWithOwner !== REPOSITORY ||
            data.user?.login !== PROJECT_OWNER ||
            !issue || issue.number !== ISSUE_NUMBER || issue.url !== ISSUE_URL ||
            !project || project.number !== PROJECT_NUMBER || project.closed) {
          throw new BoardError('IDENTITY', 'The repository, issue, or Project identity did not match the allowlist.');
        }
        if (!actor) throw new BoardError('AUTH', 'GitHub did not identify the authenticated developer.');
        const connection = issue.projectItems;
        if (!connection?.nodes || !connection.pageInfo) {
          throw new BoardError('SCHEMA', 'GitHub did not return the issue Project items.');
        }
        matches.push(...connection.nodes.filter(item => item?.project?.id === project.id));
        if (!connection.pageInfo.hasNextPage) break;
        cursor = connection.pageInfo.endCursor;
        if (!cursor || page === 19) throw new BoardError('PAGINATION', 'Could not inspect every issue Project item.');
      }
      if (matches.length !== 1) {
        throw new BoardError('ITEM_COUNT', `Expected one existing Project item; found ${matches.length}.`);
      }
      const item = matches[0];
      const fields = {};
      for (const name of ['Chair', 'Priority', 'Module', 'Status']) {
        const definition = project.fields?.nodes?.find(field => field?.name === name);
        const value = item.fieldValues?.nodes?.find(field => field?.field?.id === definition?.id);
        if (!definition?.id || !value?.name || !value?.optionId ||
            !definition.options?.some(option => option.id === value.optionId && option.name === value.name)) {
          throw new BoardError('FIELDS', `Missing or inconsistent ${name} field on the existing item.`);
        }
        fields[name] = { id: definition.id, name: value.name, optionId: value.optionId, options: definition.options };
      }
      return {
        actor, issue: { id: issue.id, number: issue.number, url: issue.url, title: issue.title, state: issue.state },
        project: { id: project.id, number: project.number, title: project.title },
        itemId: item.id, fields,
      };
    },
    async updateStatus(task, target) {
      const option = task.fields.Status.options.find(value => value.name === target);
      if (!option) throw new BoardError('STATUS_OPTION', `Project has no ${target} Status option.`);
      const result = await run(UPDATE_QUERY, {
        projectId: task.project.id,
        itemId: task.itemId,
        fieldId: task.fields.Status.id,
        optionId: option.id,
      });
      if (result.updateProjectV2ItemFieldValue?.projectV2Item?.id !== task.itemId) {
        throw new BoardError('WRITE_RESPONSE', 'GitHub did not confirm the existing item ID.');
      }
    },
  };
}

function runGraphql(query, variables) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    if (value === null) continue;
    args.push(typeof value === 'number' ? '-F' : '-f', `${key}=${value}`);
  }
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: false, windowsHide: true,
    timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new BoardError('CLI_MISSING', 'GitHub CLI (gh) is not installed or not on PATH.');
  if (result.error) throw new BoardError('CLI_ERROR', `GitHub CLI failed: ${result.error.message}`);
  if (result.status !== 0) throw new BoardError('GITHUB_API', 'GitHub CLI returned an API or authorization error. Run gh auth status and check Project access.');
  let body;
  try { body = JSON.parse(result.stdout); }
  catch { throw new BoardError('API_RESPONSE', 'GitHub CLI did not return valid JSON.'); }
  if (body.errors?.length) throw new BoardError('GRAPHQL', 'GitHub GraphQL reported an error; check account and Project authorization.');
  if (!body.data) throw new BoardError('API_RESPONSE', 'GitHub GraphQL returned no data.');
  return body.data;
}
