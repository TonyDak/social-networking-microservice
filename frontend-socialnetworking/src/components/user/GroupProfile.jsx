import React, { useEffect, useState } from "react";
import { getUserbyKeycloakId } from "../../services/userService";
import { getCookie } from "../../services/apiClient";
import { useUser } from "../../contexts/UserContext";
import { checkFriendship } from "../../services/friendService";

function GroupProfile({ group, onSendFriendRequest }) {
  const [members, setMembers] = useState([]);
  const [friendStatus, setFriendStatus] = useState({});
  const token = getCookie('access_token');
  const { user } = useUser();

  useEffect(() => {
    let isMounted = true;
    async function fetchMembers() {
        if (!group?.participants?.length) {
        setMembers([]);
        setFriendStatus({});
        return;
        }
        const memberDetails = await Promise.all(
        group.participants.map(id => getUserbyKeycloakId(token, id))
        );
        if (isMounted) setMembers(memberDetails);

        // Kiểm tra trạng thái bạn bè cho từng thành viên (trừ chính mình)
        const otherUserIds = group.participants.filter(id => id !== user.keycloakId);
        const statusObj = {};
        await Promise.all(
        otherUserIds.map(async (id) => {
            const res = await checkFriendship(user.keycloakId, id);
            statusObj[id] = res.isFriend;
        })
        );
        if (isMounted) setFriendStatus(statusObj);
    }
    fetchMembers();
    return () => { isMounted = false; };
    }, [group, user.keycloakId, token]);

  if (!group) {
    return <div className="flex justify-center p-8">Đang tải thông tin nhóm...</div>;
  }

  return (
    <div className="p-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Thông tin nhóm</h2>
      </div>
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 relative mb-4">
          <div className="w-full h-full rounded-full overflow-hidden border-4 border-green-200 bg-green-100 flex items-center justify-center text-3xl font-bold text-green-700">
            {group.name?.charAt(0).toUpperCase() || "?"}
          </div>
        </div>
        <h3 className="text-xl font-semibold">{group.name}</h3>
      </div>
      <div className="mb-6">
        <h4 className="text-sm text-gray-500 mb-1">Thành viên</h4>
        <p className="font-medium">{group.participants?.length || 0} thành viên</p>
        <div className="mt-4 space-y-3">
          {members.map((member, idx) => (
            <div key={member.body.keycloakId || idx} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {member.body.image ? (
                    <img src={member.body.image} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-lg font-bold text-gray-600">
                    {(member.body.firstName?.charAt(0) + member.body.lastName?.charAt(0) || member.body.username?.charAt(0) || "?").toUpperCase()}
                    </span>
                )}
                </div>
                <div className="flex-1">
                <div className="font-medium flex items-center">
                    {member.body.firstName || ""} {member.body.lastName || member.body.username || ""}
                    {member.body.keycloakId === group.creatorId && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded">
                        Trưởng nhóm
                    </span>
                    )}
                    {user?.keycloakId === member.body.keycloakId && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        Bạn
                        </span>
                    )}
                </div>
                {member.body.email && <div className="text-xs text-gray-500">{member.body.email}</div>}
                </div>
                {/* Nút kết bạn nếu chưa phải bạn và không phải chính mình */}
                {user?.keycloakId !== member.body.keycloakId && !friendStatus[member.body.keycloakId] && (
                <button
                    onClick={() => onSendFriendRequest && onSendFriendRequest(member.body.keycloakId)}
                    className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs"
                >
                    Kết bạn
                </button>
                )}
            </div>
            ))}
        </div>
      </div>
      {group.description && (
        <div className="mb-6">
          <h4 className="text-sm text-gray-500 mb-1">Mô tả nhóm</h4>
          <p className="font-medium">{group.description}</p>
        </div>
      )}
    </div>
  );
}

export default GroupProfile;