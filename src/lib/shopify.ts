const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

function requireConfig() {
  if (!STORE_DOMAIN || !ACCESS_TOKEN) {
    throw new Error(
      "Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_ACCESS_TOKEN in .env.local"
    );
  }

  return {
    storeDomain: STORE_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    accessToken: ACCESS_TOKEN,
  };
}

export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { storeDomain, accessToken } = requireConfig();

  const response = await fetch(
    `https://${storeDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API HTTP ${response.status}: ${text}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  if (!json.data) {
    throw new Error("Shopify API returned no data");
  }

  return json.data;
}

type StagedUploadsCreateData = {
  stagedUploadsCreate: {
    stagedTargets: Array<{
      url: string;
      resourceUrl: string;
      parameters: Array<{ name: string; value: string }>;
    }> | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

type FileCreateData = {
  fileCreate: {
    files: Array<{
      id: string;
      fileStatus: string;
      alt?: string | null;
    }> | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

type FileNodeData = {
  node: {
    id: string;
    fileStatus: string;
    image?: {
      url: string;
      width?: number | null;
      height?: number | null;
    } | null;
  } | null;
};

const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_NODE_QUERY = `
  query fileNode($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image {
          url
          width
          height
        }
      }
    }
  }
`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadToStagedTarget(
  url: string,
  parameters: Array<{ name: string; value: string }>,
  file: File
) {
  const form = new FormData();

  for (const param of parameters) {
    form.append(param.name, param.value);
  }

  form.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Staged upload failed (${response.status}): ${text}`);
  }
}

async function waitForFileReady(fileId: string, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await shopifyAdminGraphQL<FileNodeData>(FILE_NODE_QUERY, {
      id: fileId,
    });

    const node = data.node;

    if (!node) {
      throw new Error("Uploaded file was not found in Shopify");
    }

    if (node.fileStatus === "FAILED") {
      throw new Error("Shopify failed to process the uploaded image");
    }

    if (node.fileStatus === "READY" && node.image?.url) {
      return {
        id: node.id,
        url: node.image.url,
        width: node.image.width ?? undefined,
        height: node.image.height ?? undefined,
      };
    }

    await sleep(500);
  }

  throw new Error("Timed out waiting for Shopify to process the image");
}

export async function uploadImageToShopifyFiles(file: File) {
  const stagedData = await shopifyAdminGraphQL<StagedUploadsCreateData>(
    STAGED_UPLOADS_CREATE,
    {
      input: [
        {
          filename: file.name,
          mimeType: file.type || "image/jpeg",
          httpMethod: "POST",
          resource: "FILE",
        },
      ],
    }
  );

  const stagedErrors = stagedData.stagedUploadsCreate.userErrors;
  if (stagedErrors.length) {
    throw new Error(stagedErrors.map((e) => e.message).join("; "));
  }

  const target = stagedData.stagedUploadsCreate.stagedTargets?.[0];
  if (!target) {
    throw new Error("Shopify did not return a staged upload target");
  }

  await uploadToStagedTarget(target.url, target.parameters, file);

  const createData = await shopifyAdminGraphQL<FileCreateData>(FILE_CREATE, {
    files: [
      {
        alt: file.name,
        contentType: "IMAGE",
        originalSource: target.resourceUrl,
      },
    ],
  });

  const createErrors = createData.fileCreate.userErrors;
  if (createErrors.length) {
    throw new Error(createErrors.map((e) => e.message).join("; "));
  }

  const created = createData.fileCreate.files?.[0];
  if (!created?.id) {
    throw new Error("Shopify did not return a file id");
  }

  return waitForFileReady(created.id);
}
