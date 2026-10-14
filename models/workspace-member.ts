/** A member of the caller's workspace, as the owner pickers show them. */
export type WorkspaceMemberDTO = {
    userId: string;
    name: string;
    email: string;
    /** ADMIN | SALES_REP | SUPPORT | VIEWER */
    role: string;
};

export type WorkspaceMembersResponse = {
    members: WorkspaceMemberDTO[];
    me: { userId: string; role: string };
};
